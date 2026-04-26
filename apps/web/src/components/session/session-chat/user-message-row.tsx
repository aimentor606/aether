"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Check,
	ChevronDown,
	Copy,
	FileText,
	Image as ImageIcon,
	Reply,
	Terminal,
	Timer,
} from "lucide-react";
import { SandboxImage } from "@/components/session/sandbox-image";
import { GridFileCard } from "@/components/thread/file-attachment/GridFileCard";
import { cn } from "@/lib/utils";
import { useAetherComputerStore } from "@/stores/aether-computer-store";
import { useFilePreviewStore } from "@/stores/file-preview-store";
import { openTabAndNavigate } from "@/stores/tab-store";
import { useServerStore } from "@/stores/server-store";
import type {
	AgentPart,
	Command,
	FilePart,
	MessageWithParts,
	TextPart,
} from "@/ui";
import {
	isAgentPart,
	isAttachment,
	isFilePart,
	isLastUserMessage,
	isTextPart,
	splitUserParts,
} from "@/ui";
import { HighlightMentions } from "./highlight-mentions";
import {
	DCPNotificationCard,
	PtyExitedNotificationCard,
	AgentCompletedNotificationCard,
} from "./notification-cards";
import {
	detectCommandFromText,
	parseAgentCompletedNotifications,
	parseDCPNotifications,
	parseFileReferences,
	parsePtyExitedNotifications,
	parseReplyContext,
	parseSessionReferences,
	stripSystemPtyText,
} from "./utils";

export function UserMessageRow({
	message,
	agentNames,
	commandInfo,
	commands,
}: {
	message: MessageWithParts;
	agentNames?: string[];
	commandInfo?: { name: string; args?: string };
	commands?: Command[];
}) {
	const openFileInComputer = useAetherComputerStore(
		(s) => s.openFileInComputer,
	);
	const openPreview = useFilePreviewStore((s) => s.openPreview);
	const { attachments, stickyParts } = useMemo(
		() => splitUserParts(message.parts),
		[message.parts],
	);

	// Extract text from sticky parts, parse out <file> and <session_ref> XML references
	// Filter out both synthetic AND ignored parts from user-visible text
	const visibleTextParts = stickyParts
		.filter(isTextPart)
		.filter(
			(p) =>
				(p as TextPart).text?.trim() &&
				!(p as TextPart).synthetic &&
				!(p as any).ignored,
		) as TextPart[];
	const rawVisibleText = visibleTextParts.map((p) => p.text).join("\n");
	const {
		cleanText: textAfterPty,
		notifications: ptyNotifications,
	} = useMemo(
		() => parsePtyExitedNotifications(rawVisibleText),
		[rawVisibleText],
	);
	const {
		cleanText: textAfterAgent,
		notifications: agentCompletedNotifications,
	} = useMemo(
		() => parseAgentCompletedNotifications(textAfterPty),
		[textAfterPty],
	);
	const rawText = stripSystemPtyText(textAfterAgent);
	const { cleanText: textAfterReply, replyContext } = useMemo(
		() => parseReplyContext(rawText),
		[rawText],
	);
	const { cleanText: textAfterFiles, files: uploadedFiles } = useMemo(
		() => parseFileReferences(textAfterReply),
		[textAfterReply],
	);
	const { cleanText: text, sessions: sessionRefs } = useMemo(
		() => parseSessionReferences(textAfterFiles),
		[textAfterFiles],
	);

	// Resolve effective command info: use runtime-tracked info or fall back to template matching
	const effectiveCommandInfo = useMemo(
		() => commandInfo ?? detectCommandFromText(rawText, commands),
		[commandInfo, rawText, commands],
	);

	// Detect channel message (Telegram/Slack) in user message
	const channelMessageInfo = useMemo(() => {
		if (!rawText) return undefined;
		const headerMatch = rawText.match(
			/^\[(\w+)\s*·\s*([^·]+?)\s*·\s*message from\s+([^\]]+)\]\s*/,
		);
		if (!headerMatch) return undefined;
		const platform = headerMatch[1] as "Telegram" | "Slack";
		const context = headerMatch[2].trim();
		const userName = headerMatch[3].trim();
		const afterHeader = rawText.slice(headerMatch[0].length);
		const instrStart = afterHeader.search(
			/\n\s*(Chat ID:|── Telegram instructions|── Slack instructions)/,
		);
		const messageText =
			instrStart >= 0
				? afterHeader.slice(0, instrStart).trim()
				: afterHeader.trim();
		return { platform, context, userName, messageText };
	}, [rawText]);

	// Detect trigger_event in user message
	const triggerEventInfo = useMemo(() => {
		if (!rawText) return undefined;
		const match = rawText.match(
			/<trigger_event>\s*([\s\S]*?)\s*<\/trigger_event>/,
		);
		if (!match) return undefined;
		try {
			const data = JSON.parse(match[1]);
			const promptText = rawText
				.replace(/<trigger_event>[\s\S]*?<\/trigger_event>/, "")
				.trim();
			return { data, prompt: promptText };
		} catch {
			return undefined;
		}
	}, [rawText]);

	// Extract DCP notifications from ignored text parts
	const ignoredTextParts = stickyParts
		.filter(isTextPart)
		.filter(
			(p) => (p as any).ignored && (p as TextPart).text?.trim(),
		);
	const ignoredRawText = ignoredTextParts
		.map((p) => (p as TextPart).text)
		.join("\n");
	const dcpNotifications = useMemo(() => {
		if (!ignoredRawText) return [];
		return parseDCPNotifications(ignoredRawText).notifications;
	}, [ignoredRawText]);

	// Check if any text part was edited
	const isEdited = visibleTextParts.some(
		(p) => (p as any).metadata?.edited,
	);

	// Inline file references
	const inlineFiles = stickyParts.filter(isFilePart) as FilePart[];
	const filesWithSource = inlineFiles.filter(
		(f) =>
			f.source?.text?.start !== undefined &&
			f.source?.text?.end !== undefined,
	);

	// Agent mentions
	const agentParts = stickyParts.filter(isAgentPart) as AgentPart[];

	const [expanded, setExpanded] = useState(false);
	const [canExpand, setCanExpand] = useState(false);
	const [copied, setCopied] = useState(false);
	const textRef = useRef<HTMLDivElement>(null);

	// Use ResizeObserver + rAF to reliably detect overflow after layout settles
	useEffect(() => {
		const el = textRef.current;
		if (!el || expanded) return;

		const measure = () => {
			setCanExpand(el.scrollHeight > el.clientHeight + 2);
		};

		const rafId = requestAnimationFrame(measure);

		const ro = new ResizeObserver(measure);
		ro.observe(el);

		return () => {
			cancelAnimationFrame(rafId);
			ro.disconnect();
		};
	}, [text, expanded]);

	const handleCopy = async () => {
		if (!text) return;
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Build highlighted text segments
	const segments = useMemo(() => {
		if (!text) return [];
		type SegType = "file" | "agent" | "session";

		const sessionDetected: { start: number; end: number; type: SegType }[] =
			[];
		for (const s of sessionRefs) {
			const needle = `@${s.title}`;
			const idx = text.indexOf(needle);
			if (idx !== -1) {
				sessionDetected.push({
					start: idx,
					end: idx + needle.length,
					type: "session",
				});
			}
		}

		const serverRefs = [
			...filesWithSource.map((f) => ({
				start: f.source!.text!.start,
				end: f.source!.text!.end,
				type: "file" as SegType,
			})),
			...agentParts
				.filter(
					(a) =>
						a.source?.start !== undefined &&
						a.source?.end !== undefined,
				)
				.map((a) => ({
					start: a.source!.start,
					end: a.source!.end,
					type: "agent" as SegType,
				})),
		].filter(
			(r) =>
				!sessionDetected.some(
					(s) => r.start >= s.start && r.start < s.end,
				),
		);

		const allRefs = [...sessionDetected, ...serverRefs];

		if (allRefs.length > 0) {
			allRefs.sort((a, b) => a.start - b.start || b.end - a.end);
			const result: { text: string; type?: SegType }[] = [];
			let lastIndex = 0;
			for (const ref of allRefs) {
				if (ref.start < lastIndex) continue;
				if (ref.start > lastIndex)
					result.push({ text: text.slice(lastIndex, ref.start) });
				result.push({
					text: text.slice(ref.start, ref.end),
					type: ref.type,
				});
				lastIndex = ref.end;
			}
			if (lastIndex < text.length)
				result.push({ text: text.slice(lastIndex) });
			return result;
		}

		// Fallback: detect @mentions from text using regex
		const agentSet = new Set(agentNames || []);
		const mentionRegex = /@(\S+)/g;
		const detected: { start: number; end: number; type: SegType }[] = [];
		let match: RegExpExecArray | null;
		while ((match = mentionRegex.exec(text)) !== null) {
			const mStart = match.index;
			const token = match[1];
			const type: SegType = token.startsWith("ses_")
				? "session"
				: agentSet.has(token)
					? "agent"
					: "file";
			detected.push({
				start: mStart,
				end: match.index + match[0].length,
				type,
			});
		}

		if (detected.length === 0) return [{ text, type: undefined }];

		detected.sort((a, b) => a.start - b.start || b.end - a.end);
		const result: { text: string; type?: SegType }[] = [];
		let lastIndex = 0;
		for (const ref of detected) {
			if (ref.start < lastIndex) continue;
			if (ref.start > lastIndex)
				result.push({ text: text.slice(lastIndex, ref.start) });
			result.push({
				text: text.slice(ref.start, ref.end),
				type: ref.type,
			});
			lastIndex = ref.end;
		}
		if (lastIndex < text.length)
			result.push({ text: text.slice(lastIndex) });
		return result;
	}, [text, filesWithSource, agentParts, agentNames, sessionRefs]);

	// If the message is purely DCP notifications (no real user content), render only the cards
	const hasUserContent = !!(
		text ||
		replyContext ||
		uploadedFiles.length > 0 ||
		sessionRefs.length > 0 ||
		ptyNotifications.length > 0 ||
		agentCompletedNotifications.length > 0 ||
		attachments.length > 0
	);

	if (
		!hasUserContent &&
		(dcpNotifications.length > 0 ||
			ptyNotifications.length > 0 ||
			agentCompletedNotifications.length > 0)
	) {
		return (
			<div className="flex flex-col gap-1.5 w-full">
				{ptyNotifications.map((n, i) => (
					<PtyExitedNotificationCard
						key={`pty-${i}`}
						notification={n}
					/>
				))}
				{agentCompletedNotifications.map((n, i) => (
					<AgentCompletedNotificationCard
						key={`agent-${i}`}
						notification={n}
					/>
				))}
				{dcpNotifications.map((n, i) => (
					<DCPNotificationCard key={i} notification={n} />
				))}
			</div>
		);
	}

	// Channel messages (Telegram/Slack): render as a branded card with user name
	if (channelMessageInfo) {
		const isTelegram = channelMessageInfo.platform === "Telegram";
		return (
			<div className="flex flex-col items-end gap-1">
				<div className="inline-flex flex-col gap-1.5 px-4 py-2.5 rounded-2xl border border-border/60 bg-muted/40 max-w-[85%]">
					<div className="flex items-center gap-2">
						<svg
							className="size-3.5 shrink-0"
							viewBox="0 0 24 24"
							fill={isTelegram ? "#29B6F6" : "#E91E63"}
						>
							{isTelegram ? (
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
							) : (
								<path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
							)}
						</svg>
						<span
							className="text-xs font-medium"
							style={{
								color: isTelegram ? "#29B6F6" : "#E91E63",
							}}
						>
							{channelMessageInfo.platform}
						</span>
						<span className="text-xs text-muted-foreground">·</span>
						<span className="text-sm font-medium text-foreground">
							{channelMessageInfo.userName}
						</span>
					</div>
					{channelMessageInfo.messageText && (
						<div className="text-sm text-foreground break-words">
							{channelMessageInfo.messageText}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Trigger event messages: render as a right-aligned card
	if (triggerEventInfo) {
		return (
			<div className="flex flex-col items-end gap-1">
				<div className="inline-flex flex-col gap-1.5 px-4 py-2.5 rounded-2xl border border-border/60 bg-muted/40">
					<div className="flex items-center gap-2">
						<Timer className="size-3.5 text-muted-foreground shrink-0" />
						<span className="font-mono text-sm text-foreground">
							{triggerEventInfo.data?.trigger ||
								"Scheduled Task"}
						</span>
						{triggerEventInfo.data?.data?.manual && (
							<span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
								Manual
							</span>
						)}
					</div>
					{triggerEventInfo.prompt && (
						<div
							className="text-xs text-muted-foreground pl-5.5 break-words max-w-[400px]"
							style={{ paddingLeft: "1.375rem" }}
						>
							{triggerEventInfo.prompt}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Command messages: render as a right-aligned card instead of the raw template text
	if (effectiveCommandInfo) {
		return (
			<div className="flex flex-col items-end gap-1">
				<div className="inline-flex flex-col gap-1.5 px-4 py-2.5 rounded-2xl border border-border/60 bg-muted/40">
					<div className="flex items-center gap-2">
						<Terminal className="size-3.5 text-muted-foreground shrink-0" />
						<span className="font-mono text-sm text-foreground">
							/{effectiveCommandInfo.name}
						</span>
					</div>
					{effectiveCommandInfo.args && (
						<div
							className="text-xs text-muted-foreground pl-5.5 break-words max-w-[400px]"
							style={{ paddingLeft: "1.375rem" }}
						>
							{effectiveCommandInfo.args}
						</div>
					)}
				</div>
				{/* DCP notifications from ignored parts */}
				{dcpNotifications.length > 0 && (
					<div className="flex flex-col gap-1.5 w-full mt-1">
						{dcpNotifications.map((n, i) => (
							<DCPNotificationCard key={i} notification={n} />
						))}
					</div>
				)}
				{ptyNotifications.length > 0 && (
					<div className="flex flex-col gap-1.5 w-full mt-1">
						{ptyNotifications.map((n, i) => (
							<PtyExitedNotificationCard
								key={`cmd-pty-${i}`}
								notification={n}
							/>
						))}
					</div>
				)}
				{agentCompletedNotifications.length > 0 && (
					<div className="flex flex-col gap-1.5 w-full mt-1">
						{agentCompletedNotifications.map((n, i) => (
							<AgentCompletedNotificationCard
								key={`cmd-agent-${i}`}
								notification={n}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<div
				className={cn(
					"flex flex-col max-w-[90%] rounded-3xl rounded-br-lg bg-card border overflow-hidden",
					canExpand &&
						"cursor-pointer hover:bg-card/80 transition-colors",
				)}
				onClick={() => canExpand && setExpanded(!expanded)}
			>
				{/* Attachment thumbnails (images/PDFs) */}
				{attachments.length > 0 && (
					<div className="flex gap-2 p-3 pb-0 flex-wrap">
						{attachments.map((file) => (
							<div
								key={file.id}
								className="rounded-lg overflow-hidden border border-border/50"
							>
								{file.mime?.startsWith("image/") && file.url ? (
									<SandboxImage
										src={file.url}
										alt={file.filename ?? "Attachment"}
										className="max-h-32 max-w-48 object-cover"
										preview
									/>
								) : file.mime === "application/pdf" ? (
									<div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
										<FileText className="size-4 text-muted-foreground" />
										<span className="text-xs text-muted-foreground">
											{file.filename || "PDF"}
										</span>
									</div>
								) : (
									<div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
										<ImageIcon className="size-4 text-muted-foreground" />
										<span className="text-xs text-muted-foreground">
											{file.filename || "File"}
										</span>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{/* Uploaded file references (from <file> XML tags) */}
				{uploadedFiles.length > 0 && (
					<div className="flex gap-2 p-3 pb-0 flex-wrap">
						{uploadedFiles.map((f, i) => (
							<div
								key={i}
								onClick={(e) => e.stopPropagation()}
							>
								<GridFileCard
									filePath={f.path}
									fileName={
										f.path.split("/").pop() || f.path
									}
									onClick={() => openPreview(f.path)}
								/>
							</div>
						))}
					</div>
				)}

				{/* Reply context banner */}
				{replyContext && (
					<div className="flex items-center gap-2 mx-3 mt-3 mb-0 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
						<Reply className="size-3 text-primary/60 flex-shrink-0" />
						<span className="text-[11px] text-muted-foreground truncate">
							{replyContext.length > 150
								? `${replyContext.slice(0, 150)}...`
								: replyContext}
						</span>
					</div>
				)}

				{/* Text content */}
				{text && (
					<div className="relative group px-4 py-3">
						<div
							ref={textRef}
							className={cn(
								"text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0",
								!expanded && "max-h-[200px] overflow-hidden",
							)}
						>
							{segments.length > 0 ? (
								segments.map((seg, i) =>
									seg.type === "file" ? (
										<span
											key={i}
											className="text-blue-500 font-medium cursor-pointer hover:underline"
											onClick={(e) => {
												e.stopPropagation();
												openFileInComputer(
													seg.text.replace(/^@/, ""),
												);
											}}
										>
											{seg.text}
										</span>
									) : seg.type === "session" ? (
										<span
											key={i}
											className="text-emerald-500 font-medium cursor-pointer hover:underline"
											onClick={(e) => {
												e.stopPropagation();
												const raw = seg.text.replace(
													/^@/,
													"",
												);
												if (raw.startsWith("ses_")) {
													openTabAndNavigate({
														id: raw,
														title: "Session",
														type: "session",
														href: `/sessions/${raw}`,
														serverId:
															useServerStore
																.getState()
																.activeServerId,
													});
													return;
												}
												const ref = sessionRefs.find(
													(s) => s.title === raw,
												);
												if (ref) {
													openTabAndNavigate({
														id: ref.id,
														title:
															ref.title ||
															"Session",
														type: "session",
														href: `/sessions/${ref.id}`,
														serverId:
															useServerStore
																.getState()
																.activeServerId,
													});
												}
											}}
										>
											{seg.text}
										</span>
									) : (
										<span
											key={i}
											className={cn(
												seg.type === "agent" &&
													"text-purple-500 font-medium",
											)}
										>
											{seg.text}
										</span>
									),
								)
							) : (
								<span>{text}</span>
							)}
						</div>

						{/* Gradient fade overlay for collapsed long messages */}
						{canExpand && !expanded && (
							<div className="absolute inset-x-0 bottom-3 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
						)}

						{/* Expand/collapse indicator */}
						{canExpand && (
							<div className="absolute bottom-3 right-4 p-1 rounded-md bg-card/80 backdrop-blur-sm text-muted-foreground z-10">
								<ChevronDown
									className={cn(
										"size-3.5 transition-transform",
										expanded && "rotate-180",
									)}
								/>
							</div>
						)}
					</div>
				)}
			</div>
			{isEdited && (
				<span className="text-[10px] text-muted-foreground/50 pr-1">
					edited
				</span>
			)}

			{/* DCP notifications from ignored parts (rendered below user bubble if mixed) */}
			{dcpNotifications.length > 0 && (
				<div className="flex flex-col gap-1.5 w-full mt-1">
					{dcpNotifications.map((n, i) => (
						<DCPNotificationCard key={i} notification={n} />
					))}
				</div>
			)}
			{ptyNotifications.length > 0 && (
				<div className="flex flex-col gap-1.5 w-full mt-1">
					{ptyNotifications.map((n, i) => (
						<PtyExitedNotificationCard
							key={`pty-mixed-${i}`}
							notification={n}
						/>
					))}
				</div>
			)}
			{agentCompletedNotifications.length > 0 && (
				<div className="flex flex-col gap-1.5 w-full mt-1">
					{agentCompletedNotifications.map((n, i) => (
						<AgentCompletedNotificationCard
							key={`agent-mixed-${i}`}
							notification={n}
						/>
					))}
				</div>
			)}
		</div>
	);
}

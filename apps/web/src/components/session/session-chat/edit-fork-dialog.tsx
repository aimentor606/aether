"use client";

import { useEffect, useState } from "react";
import { GitFork, Loader2, Pencil } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Part, TextPart } from "@/ui";
import { isTextPart } from "@/ui";

// ============================================================================
// Edit Part Dialog — inline editing for text parts
// ============================================================================

export function EditPartDialog({
	open,
	onOpenChange,
	initialText,
	onSave,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialText: string;
	onSave: (text: string) => void;
	loading?: boolean;
}) {
	const [text, setText] = useState(initialText);

	// Reset text when dialog opens with new content
	useEffect(() => {
		if (open) setText(initialText);
	}, [open, initialText]);

	const handleSave = () => {
		const trimmed = text.trim();
		if (trimmed && trimmed !== initialText) {
			onSave(trimmed);
		} else {
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
				<DialogHeader className="flex-shrink-0">
					<DialogTitle>Edit fork prompt</DialogTitle>
					<DialogDescription>
						This creates a native fork at this message and opens the
						new session with your edited prompt restored in the
						composer.
					</DialogDescription>
				</DialogHeader>
				<div className="flex-1 min-h-0 py-2">
					<Textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						className="min-h-[120px] max-h-[50vh] h-full text-sm resize-y"
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								handleSave();
							}
						}}
					/>
				</div>
				<DialogFooter className="flex-shrink-0">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={
							loading ||
							!text.trim() ||
							text.trim() === initialText
						}
					>
						{loading ? (
							<Loader2 className="size-3.5 animate-spin mr-1.5" />
						) : null}
						Fork with edits
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ============================================================================
// Confirm Fork Dialog
// ============================================================================

export function ConfirmForkDialog({
	open,
	onOpenChange,
	onConfirm,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	loading?: boolean;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Fork session?</DialogTitle>
					<DialogDescription>
						This will create a new session from this point in the
						conversation. The fork opens separately and won&apos;t
						change this session.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={loading}>
						{loading ? (
							<Loader2 className="size-3.5 animate-spin mr-1.5" />
						) : null}
						Fork session
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ============================================================================
// Part Actions — edit & fork action for user message parts
// ============================================================================

export function PartActions({
	part,
	isBusy,
	onEditFork,
	loading,
	className,
}: {
	part: Part;
	isBusy: boolean;
	onEditFork: (newText: string) => void;
	loading?: boolean;
	className?: string;
}) {
	const [editOpen, setEditOpen] = useState(false);

	// Only text parts are editable
	const isEditable =
		isTextPart(part) && !!(part as TextPart).text?.trim();
	const partText = isEditable ? (part as TextPart).text : "";

	if (!isEditable) return null;

	return (
		<>
			<div className={cn("flex items-center gap-0.5", className)}>
				{/* Edit & fork button */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							className="text-muted-foreground/50"
							onClick={() => setEditOpen(true)}
						>
							<Pencil className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" className="text-xs">
						Edit fork prompt
					</TooltipContent>
				</Tooltip>
			</div>

			{/* Edit & fork dialog */}
			<EditPartDialog
				open={editOpen}
				onOpenChange={setEditOpen}
				initialText={partText}
				onSave={(newText) => {
					onEditFork(newText);
					setEditOpen(false);
				}}
				loading={loading}
			/>
		</>
	);
}

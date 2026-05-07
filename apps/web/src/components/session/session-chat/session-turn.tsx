'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
  GitFork,
  Layers,
  Terminal,
} from 'lucide-react';
import { ConnectProviderDialog } from '@/components/session/model-selector';
import { ToolPartRenderer } from '@/components/session/tool-renderers';
import { SandboxUrlDetector } from '@/components/shared-ui/content/sandbox-url-detector';
import { Button } from '@/components/ui/button';
import { AetherLoader } from '@/components/ui/aether-loader';
import { AnimatedThinkingText } from '@/components/ui/animated-thinking-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  extractSessionReport,
  type SessionReport,
} from '@/lib/utils/aether-system-tags';
import type { ProviderListResponse } from '@/hooks/opencode/use-opencode-sessions';
import {
  type Command,
  collectTurnParts,
  findLastTextPart,
  formatCost,
  formatDuration,
  formatTokens,
  getHiddenToolParts,
  getPermissionForTool,
  getRetryInfo,
  getRetryMessage,
  getShellModePart,
  getTurnCost,
  getTurnError,
  getTurnStatus,
  getWorkingState,
  isAgentPart,
  isAttachment,
  isCompactionPart,
  isLastUserMessage,
  isReasoningPart,
  isSnapshotPart,
  isPatchPart,
  isTextPart,
  isToolPart,
  isToolPartHidden,
  shouldShowToolPart,
  type MessageWithParts,
  type Part,
  type PartWithMessage,
  type PermissionRequest,
  type QuestionRequest,
  type TextPart,
  type ToolPart,
  type Turn,
  type TurnCostInfo,
} from '@/ui';
import {
  SessionRetryDisplay,
  TurnErrorDisplay,
} from '@/components/session/session-error-banner';
import { SubSessionModal } from '@/components/session/sub-session-modal';
import { ConfirmForkDialog, PartActions } from './edit-fork-dialog';
import { ThrottledMarkdown, ReasoningPartCard } from './markdown-rendering';
import { AnsweredQuestionCard } from './notification-cards';
import { UserMessageRow } from './user-message-row';
import {
  stripSystemPtyText,
  detectCommandFromText,
  parseAnswersFromOutput,
  optimisticAnswersCache,
} from './utils';

// ============================================================================
// Session Turn — core turn component
// ============================================================================

export interface SessionTurnProps {
  turn: Turn;
  allMessages: MessageWithParts[];
  sessionId: string;
  sessionStatus: import('@/ui').SessionStatus | undefined;
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  agentNames?: string[];
  /** Whether this is the first turn in the session */
  isFirstTurn: boolean;
  /** Whether the session is busy */
  isBusy: boolean;
  /** Whether this turn contains a compaction */
  isCompaction?: boolean;
  /** Fork the session at a user message (copies messages before this point) */
  onFork: (userMessageId: string) => Promise<void>;
  /** Fork the session at a user message and prefill with edited text */
  onEditFork: (userMessageId: string, newText: string) => Promise<void>;
  /** Providers data for the Connect Provider dialog */
  providers?: ProviderListResponse;
  /** Map of user message IDs to command info for rendering command pills */
  commandMessages?: Map<string, { name: string; args?: string }>;
  /** Available commands for template prefix matching (page refresh detection) */
  commands?: Command[];
  /** Permission reply handler */
  onPermissionReply: (
    requestId: string,
    reply: 'once' | 'always' | 'reject',
  ) => Promise<void>;
}

export function SessionTurn({
  turn,
  allMessages,
  sessionId,
  sessionStatus,
  permissions,
  questions,
  agentNames,
  isFirstTurn,
  isBusy,
  isCompaction,
  onFork,
  onEditFork,
  providers,
  commandMessages,
  commands,
  onPermissionReply,
}: SessionTurnProps) {
  const [copied, setCopied] = useState(false);
  const [userCopied, setUserCopied] = useState(false);
  const [connectProviderOpen, setConnectProviderOpen] = useState(false);
  const [editForkLoading, setEditForkLoading] = useState(false);

  // Derived state from shared helpers
  const allParts = useMemo(() => collectTurnParts(turn), [turn]);
  const hasSteps = useMemo(() => {
    return allParts.some(({ part }) => {
      if (
        part.type === 'compaction' ||
        part.type === 'snapshot' ||
        part.type === 'patch'
      )
        return true;
      if (isToolPart(part)) {
        if (
          part.tool === 'todowrite' ||
          part.tool === 'task' ||
          part.tool === 'question'
        )
          return false;
        return shouldShowToolPart(part);
      }
      return false;
    });
  }, [allParts]);
  const hasReasoning = useMemo(
    () =>
      allParts.some(({ part }) => isReasoningPart(part) && !!part.text?.trim()),
    [allParts],
  );
  const isLast = useMemo(
    () => isLastUserMessage(turn.userMessage.info.id, allMessages),
    [turn.userMessage.info.id, allMessages],
  );
  const working = useMemo(
    () => getWorkingState(sessionStatus, isLast) || (isLast && isBusy),
    [sessionStatus, isLast, isBusy],
  );
  const activeAssistantMessage = useMemo(() => {
    if (turn.assistantMessages.length === 0) return undefined;
    for (let i = turn.assistantMessages.length - 1; i >= 0; i--) {
      const msg = turn.assistantMessages[i];
      if (!(msg.info as any)?.time?.completed) return msg;
    }
    return turn.assistantMessages[turn.assistantMessages.length - 1];
  }, [turn.assistantMessages]);
  const streamingResponseRaw = useMemo(() => {
    if (!activeAssistantMessage) return '';
    return activeAssistantMessage.parts
      .filter(isTextPart)
      .map((p) => p.text ?? '')
      .join('');
  }, [activeAssistantMessage]);
  const lastTextPart = useMemo(() => findLastTextPart(allParts), [allParts]);
  const responseRaw = lastTextPart?.text ?? '';
  const abortedTextFallback = useMemo(() => {
    if (responseRaw) return '';
    const hasError = turn.assistantMessages.some((m) => (m.info as any).error);
    if (!hasError) return '';
    const texts: string[] = [];
    for (const { part } of allParts) {
      if (isTextPart(part) && part.text?.trim()) {
        texts.push(part.text);
      }
    }
    return texts.join('\n\n').trim();
  }, [responseRaw, allParts, turn.assistantMessages]);
  const completedTextParts = useMemo(
    () =>
      allParts
        .map(({ part }) => (isTextPart(part) ? part.text?.trim() : ''))
        .filter((text): text is string => Boolean(text)),
    [allParts],
  );
  const response = working
    ? streamingResponseRaw || responseRaw
    : !hasSteps && completedTextParts.length > 0
      ? completedTextParts.join('\n\n')
      : responseRaw.trim() || abortedTextFallback;
  const retryInfo = useMemo(
    () => (isLast ? getRetryInfo(sessionStatus) : undefined),
    [sessionStatus, isLast],
  );
  const retryMessage = useMemo(
    () => (isLast ? getRetryMessage(sessionStatus) : undefined),
    [sessionStatus, isLast],
  );

  const costInfo = useMemo(
    () => (!working ? getTurnCost(allParts) : undefined),
    [allParts, working],
  );

  const turnError = useMemo(() => {
    const msgError = getTurnError(turn);
    if (msgError) return msgError;
    for (const msg of turn.assistantMessages) {
      for (const part of msg.parts) {
        if (part.type !== 'tool') continue;
        const tool = part as ToolPart;
        if (
          tool.tool === 'question' &&
          tool.state.status === 'error' &&
          'error' in tool.state
        ) {
          return (tool.state as { error: string }).error.replace(
            /^Error:\s*/,
            '',
          );
        }
      }
    }
    return undefined;
  }, [turn]);

  const shellModePart = useMemo(() => getShellModePart(turn), [turn]);

  const nextPermission = useMemo(
    () => permissions.filter((p) => p.sessionID === sessionId)[0],
    [permissions, sessionId],
  );

  const nextQuestion = useMemo(() => {
    const sessionQuestions = questions.filter((q) => q.sessionID === sessionId);
    if (sessionQuestions.length === 0) return undefined;
    const turnMessageIds = new Set(
      turn.assistantMessages.map((m) => m.info.id),
    );
    const matched = sessionQuestions.find(
      (q) => q.tool && turnMessageIds.has(q.tool.messageID),
    );
    if (matched) return matched;
    if (isLast) return sessionQuestions[0];
    return undefined;
  }, [questions, sessionId, turn.assistantMessages, isLast]);

  const hidden = useMemo(
    () => getHiddenToolParts(nextPermission, nextQuestion),
    [nextPermission, nextQuestion],
  );

  const answeredQuestionParts = useMemo(() => {
    const pendingCallIds = new Set(
      questions
        .filter((q) => q.sessionID === sessionId)
        .map((q) => q.tool?.callID)
        .filter(Boolean),
    );

    const questionInfos: {
      tool: ToolPart;
      msgId: string;
      msgIndex: number;
      partIndex: number;
    }[] = [];
    for (let mi = 0; mi < turn.assistantMessages.length; mi++) {
      const msg = turn.assistantMessages[mi];
      for (let pi = 0; pi < msg.parts.length; pi++) {
        const part = msg.parts[pi];
        if (part.type !== 'tool') continue;
        const tool = part as ToolPart;
        if (tool.tool !== 'question') continue;
        questionInfos.push({
          tool,
          msgId: msg.info.id,
          msgIndex: mi,
          partIndex: pi,
        });
      }
    }

    const result: { part: ToolPart; messageId: string }[] = [];
    for (const qInfo of questionInfos) {
      const { tool, msgId, msgIndex, partIndex } = qInfo;

      const hasSubsequentContent = (() => {
        const msg = turn.assistantMessages[msgIndex];
        for (let pi = partIndex + 1; pi < msg.parts.length; pi++) {
          const p = msg.parts[pi];
          if (p.type === 'step-finish' || p.type === 'step-start') continue;
          return true;
        }
        return msgIndex < turn.assistantMessages.length - 1;
      })();

      const isPending = pendingCallIds.has(tool.callID);

      if (isPending && !hasSubsequentContent) continue;

      const serverAnswers = (tool.state as any)?.metadata?.answers;
      const cached = optimisticAnswersCache.get(tool.id);
      const toolOutput = (tool.state as any)?.output as string | undefined;

      if (serverAnswers && serverAnswers.length > 0) {
        if (cached) optimisticAnswersCache.delete(tool.id);
        result.push({ part: tool, messageId: msgId });
      } else if (cached) {
        const syntheticPart = {
          ...tool,
          state: {
            ...(tool.state as any),
            status: 'completed',
            input: cached.input,
            metadata: {
              ...((tool.state as any)?.metadata ?? {}),
              answers: cached.answers,
            },
          },
        } as unknown as ToolPart;
        result.push({ part: syntheticPart, messageId: msgId });
      } else if (toolOutput && hasSubsequentContent) {
        const parsed = parseAnswersFromOutput(
          toolOutput,
          (tool.state as any)?.input,
        );
        if (parsed) {
          const syntheticPart = {
            ...tool,
            state: {
              ...(tool.state as any),
              status: 'completed',
              metadata: {
                ...((tool.state as any)?.metadata ?? {}),
                answers: parsed,
              },
            },
          } as unknown as ToolPart;
          result.push({ part: syntheticPart, messageId: msgId });
        }
      } else if (!toolOutput && hasSubsequentContent) {
        const input = (tool.state as any)?.input;
        const questionsList: { question: string }[] = Array.isArray(
          input?.questions,
        )
          ? input.questions
          : [];
        if (questionsList.length > 0) {
          const placeholderAnswers = questionsList.map(() => ['Answered']);
          const syntheticPart = {
            ...tool,
            state: {
              ...(tool.state as any),
              status: 'completed',
              metadata: {
                ...((tool.state as any)?.metadata ?? {}),
                answers: placeholderAnswers,
              },
            },
          } as unknown as ToolPart;
          result.push({ part: syntheticPart, messageId: msgId });
        }
      }
    }
    return result;
  }, [questions, sessionId, turn.assistantMessages]);
  const answeredQuestionIds = useMemo(
    () => new Set(answeredQuestionParts.map(({ part }) => part.id)),
    [answeredQuestionParts],
  );

  const answeredQuestionPartsById = useMemo(
    () => new Map(answeredQuestionParts.map(({ part }) => [part.id, part])),
    [answeredQuestionParts],
  );
  const inlineContentParts = useMemo(() => {
    if (answeredQuestionParts.length === 0) return null;
    const items: Array<
      | { type: 'text'; part: TextPart; id: string }
      | { type: 'question'; part: ToolPart; id: string }
    > = [];
    for (const { part } of allParts) {
      if (isTextPart(part) && part.text?.trim()) {
        items.push({ type: 'text', part, id: part.id });
      } else if (
        isToolPart(part) &&
        part.tool === 'question' &&
        answeredQuestionPartsById.has(part.id)
      ) {
        items.push({
          type: 'question',
          part: answeredQuestionPartsById.get(part.id)!,
          id: part.id,
        });
      }
    }
    const hasText = items.some((i) => i.type === 'text');
    const hasQuestion = items.some((i) => i.type === 'question');
    if (!hasText || !hasQuestion) return null;
    return items;
  }, [allParts, answeredQuestionPartsById, answeredQuestionParts.length]);
  const shouldUseInlineContent = !hasSteps && !!inlineContentParts;

  const sessionReport = useMemo<SessionReport | null>(() => {
    for (const p of turn.userMessage.parts) {
      if (isTextPart(p)) {
        const report = extractSessionReport((p as TextPart).text || '');
        if (report) return report;
      }
    }
    return null;
  }, [turn.userMessage.parts]);
  const [sessionReportModalOpen, setSessionReportModalOpen] = useState(false);

  const hasVisibleUserContent = useMemo(() => {
    if (sessionReport) return false;
    const parts = turn.userMessage.parts;
    if (parts.length === 0) return true;
    const hasVisibleText = parts.some(
      (p) =>
        isTextPart(p) &&
        !(p as TextPart).synthetic &&
        !(p as any).ignored &&
        (!!stripSystemPtyText((p as TextPart).text || '') ||
          (p as TextPart).text?.includes('<pty_exited>') ||
          (p as TextPart).text?.includes('<agent_completed>') ||
          (p as TextPart).text?.includes('<agent_failed>') ||
          (p as TextPart).text?.includes('<agent_stopped>')),
    );
    if (hasVisibleText) return true;
    if (parts.some(isAttachment)) return true;
    if (parts.some(isAgentPart)) return true;
    return false;
  }, [turn.userMessage.parts, sessionReport]);

  const userMessageText = useMemo(() => {
    const textParts = turn.userMessage.parts.filter(
      (p) => isTextPart(p) && !(p as TextPart).synthetic && !(p as any).ignored,
    ) as TextPart[];
    return textParts
      .map((p) => stripSystemPtyText(p.text))
      .filter((t) => t.trim())
      .join('\n')
      .trim();
  }, [turn.userMessage.parts]);

  const commandForTurn = useMemo(() => {
    const mapped = commandMessages?.get(turn.userMessage.info.id);
    if (mapped) return mapped;
    if (!userMessageText) return undefined;
    return detectCommandFromText(userMessageText, commands);
  }, [commandMessages, turn.userMessage.info.id, userMessageText, commands]);

  const handleCopyUser = async () => {
    if (!userMessageText) return;
    await navigator.clipboard.writeText(userMessageText);
    setUserCopied(true);
    setTimeout(() => setUserCopied(false), 2000);
  };

  // ---- Status throttling (2.5s) ----
  const lastStatusChangeRef = useRef(Date.now());
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const childMessages = undefined as MessageWithParts[] | undefined;
  const rawStatus = useMemo(
    () => getTurnStatus(allParts, childMessages),
    [allParts, childMessages],
  );
  const [throttledStatus, setThrottledStatus] = useState('');

  useEffect(() => {
    const newStatus = rawStatus;
    if (newStatus === throttledStatus || !newStatus) return;
    const elapsed = Date.now() - lastStatusChangeRef.current;
    if (elapsed >= 2500) {
      setThrottledStatus(newStatus);
      lastStatusChangeRef.current = Date.now();
    } else {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => {
        setThrottledStatus(getTurnStatus(allParts, childMessages));
        lastStatusChangeRef.current = Date.now();
      }, 2500 - elapsed);
    }
    return () => clearTimeout(statusTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allParts, rawStatus, throttledStatus]);

  // ---- Retry countdown ----
  const [retrySecondsLeft, setRetrySecondsLeft] = useState(0);
  useEffect(() => {
    if (!retryInfo) {
      setRetrySecondsLeft(0);
      return;
    }
    const update = () =>
      setRetrySecondsLeft(
        Math.max(0, Math.round((retryInfo.next - Date.now()) / 1000)),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryInfo]);

  // ---- Duration ticking ----
  const [duration, setDuration] = useState('');
  useEffect(() => {
    const startTime = (turn.userMessage.info as any)?.time?.created;

    if (!working) {
      const lastMsg = turn.assistantMessages[turn.assistantMessages.length - 1];
      const endTime =
        (lastMsg?.info as any)?.time?.completed ||
        (lastMsg?.info as any)?.time?.created ||
        startTime;
      setDuration(formatDuration(endTime - startTime));
      return;
    }
    const update = () => setDuration(formatDuration(Date.now() - startTime));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [working, turn]);

  // ---- Copy response ----
  const handleCopy = async () => {
    const textToCopy = inlineContentParts
      ? inlineContentParts
          .filter((item) => item.type === 'text')
          .map((item) => (item.part as TextPart).text?.trim())
          .filter(Boolean)
          .join('\n\n')
      : response;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ============================================================================
  // Shell mode — short-circuit rendering
  // ============================================================================

  if (shellModePart) {
    return (
      <div className="space-y-1">
        <ToolPartRenderer
          part={shellModePart}
          sessionId={sessionId}
          permission={nextPermission?.tool ? nextPermission : undefined}
          onPermissionReply={onPermissionReply}
          defaultOpen
        />
        {turnError && (
          <TurnErrorDisplay errorText={turnError} className="mt-2" />
        )}
        <ConnectProviderDialog
          open={connectProviderOpen}
          onOpenChange={setConnectProviderOpen}
          providers={providers}
        />
      </div>
    );
  }

  // ============================================================================
  // Compaction mode — render as a distinct card
  // ============================================================================

  if (isCompaction && !working && response) {
    return (
      <div className="group/turn">
        <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/40">
            <Layers className="size-3.5 text-muted-foreground/70" />
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              Compaction
            </span>
          </div>
          <div className="px-4 py-3 text-sm text-muted-foreground/90 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground/90">
            <SandboxUrlDetector content={response} isStreaming={false} />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Normal mode rendering
  // ============================================================================

  return (
    <div className="space-y-3 group/turn">
      {/* Session report card */}
      {sessionReport && (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setSessionReportModalOpen(true)}
            onKeyDown={(e) =>
              e.key === 'Enter' && setSessionReportModalOpen(true)
            }
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
              'border select-none cursor-pointer transition-colors group/report',
              sessionReport.status === 'COMPLETE'
                ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                : 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10',
            )}
          >
            {sessionReport.status === 'COMPLETE' ? (
              <CheckCircle className="size-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="size-3.5 text-destructive flex-shrink-0" />
            )}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span
                className={cn(
                  'font-medium',
                  sessionReport.status === 'COMPLETE'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-destructive',
                )}
              >
                Worker{' '}
                {sessionReport.status === 'COMPLETE' ? 'Complete' : 'Failed'}
              </span>
              {sessionReport.project && (
                <span className="text-muted-foreground/60">
                  · {sessionReport.project}
                </span>
              )}
              {sessionReport.prompt && (
                <span className="text-muted-foreground/60 truncate">
                  {sessionReport.prompt.slice(0, 60)}
                </span>
              )}
            </div>
            <ExternalLink className="size-3 flex-shrink-0 text-muted-foreground/60 group-hover/report:text-muted-foreground/60 transition-colors" />
          </div>
          <SubSessionModal
            open={sessionReportModalOpen}
            onOpenChange={setSessionReportModalOpen}
            sessionId={sessionReport.sessionId}
            title={`Worker${sessionReport.project ? ` · ${sessionReport.project}` : ''}`}
          />
        </>
      )}

      {/* User message */}
      {hasVisibleUserContent && (
        <div>
          <UserMessageRow
            message={turn.userMessage}
            agentNames={agentNames}
            commandInfo={commandMessages?.get(turn.userMessage.info.id)}
            commands={commands}
          />
          {userMessageText && (
            <div className="flex justify-end mt-1 opacity-0 group-hover/turn:opacity-100 transition-opacity duration-150">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCopyUser}
                  >
                    {userCopied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {userCopied ? 'Copied!' : 'Copy'}
                </TooltipContent>
              </Tooltip>
              {(() => {
                const userTextPart = turn.userMessage.parts.find(
                  (p) =>
                    isTextPart(p) &&
                    !(p as TextPart).synthetic &&
                    !(p as any).ignored &&
                    !!stripSystemPtyText((p as TextPart).text || ''),
                );
                if (!userTextPart) return null;
                return (
                  <PartActions
                    part={userTextPart}
                    isBusy={isBusy}
                    onEditFork={(newText) =>
                      onEditFork(turn.userMessage.info.id, newText)
                    }
                    loading={editForkLoading}
                  />
                );
              })()}
              {/* Fork button — on user messages */}
              {!isBusy && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onFork(turn.userMessage.info.id)}
                    >
                      <GitFork className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fork to new session</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      )}

      {/* Aether logo header */}
      {(working || hasSteps || hasReasoning) && (
        <div className="flex items-center gap-2 mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aether-logomark-white.svg"
            alt="Aether"
            className="dark:invert-0 invert flex-shrink-0 h-[14px] w-auto"
          />
        </div>
      )}

      {/* Assistant parts content */}
      {(working || hasSteps || hasReasoning) &&
        turn.assistantMessages.length > 0 && (
          <div className="space-y-2">
            {allParts.map(({ part, message }) => {
              if (
                shouldUseInlineContent &&
                isTextPart(part) &&
                part.text?.trim()
              )
                return null;

              if (isTextPart(part)) {
                if (!part.text?.trim()) return null;
                if (!hasSteps) return null;
                return (
                  <div key={part.id} className="text-sm">
                    <ThrottledMarkdown
                      content={part.text}
                      isStreaming={working}
                    />
                  </div>
                );
              }

              if (isReasoningPart(part)) {
                if (!part.text?.trim()) return null;
                const reasoningActive =
                  working && permissions.length === 0 && questions.length === 0;
                return (
                  <ReasoningPartCard
                    key={part.id}
                    part={part}
                    isStreaming={reasoningActive}
                  />
                );
              }

              if (isCompactionPart(part)) {
                return (
                  <div key={part.id} className="flex items-center gap-2 py-2.5">
                    <div className="flex-1 h-px bg-border" />
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/80 border border-border/60">
                      <Layers className="size-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">
                        Compaction
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                );
              }

              if (isToolPart(part)) {
                if (!shouldShowToolPart(part)) return null;
                if (part.tool === 'todowrite') return null;
                if (part.tool === 'question') {
                  if (shouldUseInlineContent) return null;
                  const answeredPart = answeredQuestionPartsById.get(part.id);
                  if (answeredPart) {
                    return (
                      <AnsweredQuestionCard
                        key={part.id}
                        part={answeredPart}
                        defaultExpanded
                      />
                    );
                  }
                  return null;
                }

                const perm = getPermissionForTool(permissions, part.callID);

                if (isToolPartHidden(part, message.info.id, hidden))
                  return null;

                return (
                  <div key={part.id}>
                    <ToolPartRenderer
                      part={part}
                      sessionId={sessionId}
                      permission={perm}
                      onPermissionReply={onPermissionReply}
                    />
                  </div>
                );
              }

              if (isSnapshotPart(part) || isPatchPart(part)) {
                return null;
              }

              return null;
            })}
          </div>
        )}

      {/* Aether logo — no steps, not working */}
      {!hasSteps &&
        !hasReasoning &&
        !working &&
        (response || answeredQuestionParts.length > 0 || turnError) && (
          <div className="flex items-center gap-2 mt-3 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aether-logomark-white.svg"
              alt="Aether"
              className="dark:invert-0 invert flex-shrink-0 h-[14px] w-auto"
            />
          </div>
        )}

      {/* Screen reader */}
      <div className="sr-only" aria-live="polite">
        {!working && response ? response : ''}
      </div>

      {/* Inline content during streaming */}
      {working && !hasSteps && !shouldUseInlineContent && response && (
        <div className="text-sm">
          <ThrottledMarkdown content={response} isStreaming />
        </div>
      )}
      {shouldUseInlineContent ? (
        <div className="space-y-3">
          {(() => {
            let lastTextIdx = -1;
            if (working) {
              for (let i = inlineContentParts!.length - 1; i >= 0; i--) {
                if (inlineContentParts![i].type === 'text') {
                  lastTextIdx = i;
                  break;
                }
              }
            }
            return inlineContentParts!.map((item, idx) => {
              if (item.type === 'text') {
                const isStreaming = idx === lastTextIdx;
                const text = isStreaming
                  ? item.part.text!
                  : item.part.text!.trim();
                return (
                  <div key={item.id} className="text-sm">
                    {isStreaming ? (
                      <ThrottledMarkdown content={text} isStreaming />
                    ) : (
                      <SandboxUrlDetector content={text} isStreaming={false} />
                    )}
                  </div>
                );
              }
              return (
                <AnsweredQuestionCard
                  key={item.id}
                  part={item.part}
                  defaultExpanded
                />
              );
            });
          })()}
        </div>
      ) : (
        <>
          {/* Response section for text-only turns */}
          {!working &&
            !hasSteps &&
            response &&
            (commandForTurn ? (
              <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-muted/15 to-background overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/25">
                  <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-foreground">
                    /{commandForTurn.name}
                  </span>
                  {commandForTurn.args && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      {commandForTurn.args}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-sm">
                  <SandboxUrlDetector content={response} isStreaming={false} />
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <SandboxUrlDetector content={response} isStreaming={false} />
              </div>
            ))}

          {/* Answered question parts */}
          {!hasSteps && !working && answeredQuestionParts.length > 0 && (
            <div className="space-y-2 mt-3">
              {answeredQuestionParts.map(({ part }) => (
                <AnsweredQuestionCard key={part.id} part={part as ToolPart} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Working status indicator */}
      {working && (
        <div className="space-y-2">
          {retryInfo && retryMessage && (
            <SessionRetryDisplay
              message={retryMessage}
              attempt={retryInfo.attempt}
              secondsLeft={retrySecondsLeft}
            />
          )}
          <div
            className={cn(
              'flex items-center gap-2 text-xs transition-colors py-1',
              'text-muted-foreground',
            )}
          >
            <span className="relative flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground/30" />
              <span className="relative inline-flex rounded-full size-3 bg-muted-foreground/50" />
            </span>
            {retryInfo ? (
              <span className="text-muted-foreground/70">Waiting to retry</span>
            ) : (
              <AnimatedThinkingText
                statusText={throttledStatus || undefined}
                className="text-xs"
              />
            )}
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground/70">{duration}</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {turnError && <TurnErrorDisplay errorText={turnError} />}

      {/* Action bar */}
      {!working && response && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover/turn:opacity-100 transition-opacity duration-150">
          {duration && (
            <span className="text-[11px] text-muted-foreground/50 mr-1">
              {duration}
              {costInfo && (
                <>
                  {' '}
                  · {formatCost(costInfo.cost)} ·{' '}
                  {formatTokens(costInfo.tokens.input + costInfo.tokens.output)}
                  t
                </>
              )}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
          </Tooltip>
        </div>
      )}

      <ConnectProviderDialog
        open={connectProviderOpen}
        onOpenChange={setConnectProviderOpen}
        providers={providers}
      />
    </div>
  );
}

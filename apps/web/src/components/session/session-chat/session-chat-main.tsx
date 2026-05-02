'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  Layers,
  ListPlus,
  Reply,
  Send,
  X,
} from 'lucide-react';
import {
  SessionChatInput,
  type TrackedMention,
} from '@/components/session/session-chat-input';
import type { AttachedFile } from '@/lib/models';
import { SessionContextModal } from '@/components/session/session-context-modal';
import { SessionSiteHeader } from '@/components/session/session-site-header';
import {
  QuestionPrompt,
  type QuestionPromptHandle,
  type QuestionAction,
} from '@/components/session/question-prompt';
import { SessionWelcome } from '@/components/session/session-welcome';
import { Button } from '@/components/ui/button';
import { AetherLoader } from '@/components/ui/aether-loader';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { uploadFile } from '@/features/files/api/opencode-files';
import { searchWorkspaceFiles } from '@/features/files';
import { useOpenCodeConfig } from '@/hooks/opencode/use-opencode-config';
import {
  useOpenCodeLocal,
  parseModelKey,
  formatModelString,
} from '@/hooks/opencode/use-opencode-local';
import {
  ascendingId,
  rejectQuestion,
  replyToPermission,
  replyToQuestion,
  useAbortOpenCodeSession,
  useForkSession,
  useOpenCodeAgents,
  useOpenCodeCommands,
  useOpenCodeProviders,
  useOpenCodeSession,
  useOpenCodeSessions,
} from '@/hooks/opencode/use-opencode-sessions';
import { useSessionSync } from '@/hooks/opencode/use-session-sync';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import { getClient } from '@/lib/opencode-sdk';
import { logger } from '@/lib/logger';
import { playSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { ChatMinimap } from '@/components/session/chat-minimap';
import { useMessageJumpStore } from '@/stores/message-jump-store';
import { useAetherComputerStore } from '@/stores/aether-computer-store';
import { useMessageQueueStore } from '@/stores/message-queue-store';
import { usePendingFilesStore } from '@/stores/pending-files-store';
import { useOpenCodePendingStore } from '@/stores/opencode-pending-store';
import { useOpenCodeCompactionStore } from '@/stores/opencode-compaction-store';
import { useFilePreviewStore } from '@/stores/file-preview-store';
import { useOpenCodeSessionStatusStore } from '@/stores/opencode-session-status-store';
import { useSyncStore } from '@/stores/opencode-sync-store';
import { useServerStore } from '@/stores/server-store';
import { openTabAndNavigate } from '@/stores/tab-store';
import type { Command, isToolPart, MessageWithParts, ToolPart } from '@/ui';
import { groupMessagesIntoTurns } from '@/ui';
import { ConfirmForkDialog } from './edit-fork-dialog';
import { HighlightMentions } from './highlight-mentions';
import { SessionTurn } from './session-turn';
import { TurnErrorDisplay } from '@/components/session/session-error-banner';
import { GridFileCard } from '@/components/shared-ui/file-attachment/GridFileCard';
import type { ReplyToContext } from './types';
import {
  buildForkPrompt,
  stashForkPrompt,
  formatCommandError,
  parseFileReferences,
  parseReplyContext,
  detectCommandFromText,
  optimisticAnswersCache,
} from './utils';

// ============================================================================
// Main SessionChat Component
// ============================================================================

interface SessionChatProps {
  sessionId: string;
  /** Optional element rendered at the leading (left) edge of the session header */
  headerLeadingAction?: React.ReactNode;
  /** Hide the session site header entirely */
  hideHeader?: boolean;
  /** Read-only mode — hides the chat input bar (used for sub-session modal viewer) */
  readOnly?: boolean;
  /** Start scrolled to the top instead of the bottom (e.g. sub-session modal viewer) */
  initialScrollTop?: boolean;
}

export function SessionChat({
  sessionId,
  headerLeadingAction,
  hideHeader,
  readOnly,
  initialScrollTop,
}: SessionChatProps) {
  // ---- Context modal ----
  const [contextModalOpen, setContextModalOpen] = useState(false);

  // ---- Question prompt ref + action state (for unified send button) ----
  const questionPromptRef = useRef<QuestionPromptHandle>(null);
  const [questionAction, setQuestionAction] = useState<{
    label: string | null;
    canAct: boolean;
  }>({ label: null, canAct: true });
  const handleQuestionActionChange = useCallback(
    (action: QuestionAction, canAct: boolean) => {
      const label =
        action === 'next' ? 'Next' : action === 'submit' ? 'Submit' : null;
      setQuestionAction({ label, canAct });
    },
    [],
  );

  // ---- Reply-to state (text selection → reply) ----
  const [replyTo, setReplyTo] = useState<ReplyToContext | null>(null);
  const handleClearReply = useCallback(() => setReplyTo(null), []);

  // Floating "Reply" popup — shown near selected text in the chat area
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const handleChatMouseUp = useCallback(() => {
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      const selectedText = sel?.toString().trim();
      if (!selectedText || selectedText.length < 2) {
        setSelectionPopup(null);
        return;
      }
      if (!sel?.rangeCount || !chatAreaRef.current?.contains(sel.anchorNode)) {
        setSelectionPopup(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = chatAreaRef.current.getBoundingClientRect();
      setSelectionPopup({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
        text: selectedText.slice(0, 500),
      });
    });
  }, []);

  const handleChatMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-reply-popup]')) return;
    setSelectionPopup(null);
  }, []);

  const handleChatScroll = useCallback(() => {
    setSelectionPopup(null);
  }, []);

  const handleSelectionReply = useCallback(() => {
    if (!selectionPopup) return;
    setReplyTo({ text: selectionPopup.text });
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopup]);

  // ---- AetherComputer side panel ----
  const { isSidePanelOpen, setIsSidePanelOpen, openFileInComputer } =
    useAetherComputerStore();
  const openPreview = useFilePreviewStore((s) => s.openPreview);
  const handleTogglePanel = useCallback(() => {
    setIsSidePanelOpen(!isSidePanelOpen);
  }, [isSidePanelOpen, setIsSidePanelOpen]);

  // ---- Hooks ----
  const { data: session, isLoading: sessionLoading } =
    useOpenCodeSession(sessionId);
  const { messages: syncMessages, isLoading: syncMessagesLoading } =
    useSessionSync(sessionId);
  const messages = syncMessages.length > 0 ? syncMessages : undefined;
  const messagesLoading = syncMessagesLoading;
  const { data: agents } = useOpenCodeAgents();
  const { data: commands } = useOpenCodeCommands();
  const { data: providers } = useOpenCodeProviders();
  const { data: allSessions } = useOpenCodeSessions();
  const { data: config } = useOpenCodeConfig();
  const abortSession = useAbortOpenCodeSession();
  const forkSession = useForkSession();

  // ---- Unified model/agent/variant state ----
  const local = useOpenCodeLocal({ agents, providers, config, sessionId });

  const pendingPromptHandled = useRef(false);

  // ---- Polling fallback & optimistic send ----
  const [pollingActive, setPollingActive] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(
    null,
  );
  const [pendingUserMessageId, setPendingUserMessageId] = useState<
    string | null
  >(null);
  const [confirmForkMessageId, setConfirmForkMessageId] = useState<
    string | null
  >(null);
  const [_pendingCommand, setPendingCommand] = useState<{
    name: string;
    description?: string;
  } | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const commandMessagesRef = useRef<
    Map<string, { name: string; args?: string }>
  >(new Map());
  const pendingCommandStashRef = useRef<{
    name: string;
    args?: string;
  } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pendingSendInFlight, setPendingSendInFlight] = useState(false);
  const [pendingSendMessageId, setPendingSendMessageId] = useState<
    string | null
  >(null);
  const lastSendTimeRef = useRef<number>(0);

  // ---- Optimistic prompt (from dashboard/project page) ----
  const [optimisticPrompt, setOptimisticPrompt] = useState<string | null>(
    () => {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem(`opencode_pending_prompt:${sessionId}`);
      }
      return null;
    },
  );

  const addOptimisticUserMessage = useCallback(
    (messageId: string, text: string, partIds?: string[]) => {
      const parts = text.trim()
        ? [
            {
              id: partIds?.[0] ?? ascendingId('prt'),
              sessionID: sessionId,
              messageID: messageId,
              type: 'text',
              text,
            } as any,
          ]
        : [];
      const info = {
        id: messageId,
        sessionID: sessionId,
        role: 'user',
        time: { created: Date.now() },
      } as any;

      useSyncStore.getState().optimisticAdd(sessionId, info, parts as any);
    },
    [sessionId],
  );

  const removeOptimisticUserMessage = useCallback(
    (messageId: string) => {
      useSyncStore.getState().optimisticRemove(sessionId, messageId);
    },
    [sessionId],
  );

  // Hydrate options from sessionStorage and send the pending prompt for new sessions.
  useEffect(() => {
    if (pendingPromptHandled.current) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attemptSend = (attempt: number) => {
      if (cancelled) return;
      const pendingPrompt = sessionStorage.getItem(
        `opencode_pending_prompt:${sessionId}`,
      );
      console.log('[session-chat] pending prompt check', {
        sessionId,
        hasPending: !!pendingPrompt,
        attempt,
      });
      if (!pendingPrompt) {
        if (attempt < 5) {
          retryTimer = setTimeout(() => attemptSend(attempt + 1), 50);
          return;
        }
        return;
      }
      pendingPromptHandled.current = true;
      setPollingActive(true);
      setPendingSendInFlight(true);
      useSyncStore.getState().setStatus(sessionId, { type: 'busy' });
      sessionStorage.removeItem(`opencode_pending_prompt:${sessionId}`);
      sessionStorage.removeItem(`opencode_pending_send_failed:${sessionId}`);

      const options: Record<string, unknown> = {};
      try {
        const raw = sessionStorage.getItem(
          `opencode_pending_options:${sessionId}`,
        );
        if (raw) {
          const pendingOptions = JSON.parse(raw);
          sessionStorage.removeItem(`opencode_pending_options:${sessionId}`);
          if (pendingOptions?.agent) {
            options.agent = pendingOptions.agent;
            local.agent.set(pendingOptions.agent as string);
          }
          if (pendingOptions?.model) {
            const parsedPendingModel = parseModelKey(pendingOptions.model);
            if (parsedPendingModel) {
              options.model = parsedPendingModel;
              local.model.set(parsedPendingModel);
            }
          }
          if (pendingOptions?.variant) {
            options.variant = pendingOptions.variant;
            local.model.variant.set(pendingOptions.variant as string);
          }
        }
      } catch {
        // ignore
      }

      const sendOpts =
        Object.keys(options).length > 0 ? (options as any) : undefined;
      const messageID = ascendingId('msg');
      const textPartId = ascendingId('prt');
      setPendingSendMessageId(messageID);
      addOptimisticUserMessage(messageID, pendingPrompt, [textPartId]);
      lastSendTimeRef.current = Date.now();

      let client: ReturnType<typeof getClient>;
      try {
        client = getClient();
      } catch {
        sessionStorage.setItem(
          `opencode_pending_prompt:${sessionId}`,
          pendingPrompt,
        );
        pendingPromptHandled.current = false;
        setPollingActive(false);
        setPendingSendInFlight(false);
        useSyncStore.getState().setStatus(sessionId, { type: 'idle' });
        removeOptimisticUserMessage(messageID);
        return;
      }
      const handlePromptError = () => {
        setIsRetrying(false);
        setPendingSendInFlight(false);
        setPendingSendMessageId(null);
        setOptimisticPrompt(null);
        setPollingActive(false);
        useSyncStore.getState().setStatus(sessionId, { type: 'idle' });
        client.session
          .messages({ sessionID: sessionId })
          .then((res) => {
            if (res.data) {
              useSyncStore.getState().hydrate(sessionId, res.data as any);
              useSyncStore.getState().clearOptimisticMessages(sessionId);
            } else {
              removeOptimisticUserMessage(messageID);
            }
          })
          .catch((error) => {
            logger.warn('Failed to hydrate messages after prompt error', {
              sessionId,
              error,
            });
            removeOptimisticUserMessage(messageID);
          });
      };

      const pendingFiles = usePendingFilesStore
        .getState()
        .consumePendingFiles();

      console.log('[session-chat] sending promptAsync for pending prompt', {
        sessionId,
        pendingFileCount: pendingFiles.length,
      });

      const sendPendingPrompt = async () => {
        const parts: Array<
          | { type: 'text'; text: string }
          | { type: 'file'; mime: string; url: string; filename: string }
        > = [{ type: 'text', text: pendingPrompt }];

        const localFiles = pendingFiles.filter(
          (f): f is Extract<typeof f, { kind: 'local' }> => f.kind === 'local',
        );
        const remoteFiles = pendingFiles.filter(
          (f): f is Extract<typeof f, { kind: 'remote' }> =>
            f.kind === 'remote',
        );

        for (const file of remoteFiles) {
          parts.push({
            type: 'file',
            mime: file.mime,
            url: file.url,
            filename: file.filename,
          });
        }

        if (localFiles.length > 0) {
          const uploadBatchTs = Date.now();
          const uploadResults = await Promise.all(
            localFiles.map(async (af, index) => {
              const safeName = af.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              const uniqueName = `${uploadBatchTs}-${index}-${safeName}`;
              const uploadBlob = new File([af.file], uniqueName, {
                type: af.file.type,
              });
              const results = await uploadFile(
                uploadBlob,
                '/workspace/uploads',
              );
              if (!results || results.length === 0) {
                throw new Error(`Failed to upload file: ${af.file.name}`);
              }
              return {
                path: results[0].path,
                mime: af.file.type || 'application/octet-stream',
                filename: af.file.name,
              };
            }),
          );
          const uploadedFileRefs = uploadResults
            .map(
              (f) =>
                `<file path="${f.path}" mime="${f.mime}" filename="${f.filename}">\nThis file has been uploaded and is available at the path above.\n</file>`,
            )
            .join('\n');
          (parts[0] as { type: 'text'; text: string }).text +=
            `\n\n${uploadedFileRefs}`;
        }

        return parts;
      };

      void sendPendingPrompt()
        .then((parts) =>
          client.session.promptAsync({
            sessionID: sessionId,
            parts,
            ...(sendOpts?.agent && { agent: sendOpts.agent }),
            ...(sendOpts?.model && { model: sendOpts.model }),
            ...(sendOpts?.variant && { variant: sendOpts.variant }),
          } as any),
        )
        .then((res: any) => {
          console.log('[session-chat] promptAsync resolved', {
            sessionId,
            status: res?.response?.status,
            hasError: !!res?.error,
            res,
          });
          if (res?.error) handlePromptError();
        })
        .catch((err: any) => {
          console.error('[session-chat] promptAsync rejected', {
            sessionId,
            err,
          });
          handlePromptError();
        });
    };

    attemptSend(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, addOptimisticUserMessage, removeOptimisticUserMessage]);

  // Clear optimistic prompt once real messages arrive
  useEffect(() => {
    if (optimisticPrompt && messages && messages.length > 0) {
      setOptimisticPrompt(null);
    }
  }, [optimisticPrompt, messages]);

  const agentNames = useMemo(
    () => local.agent.list.map((a) => a.name),
    [local.agent.list],
  );

  // ---- Check if any messages have tool calls ----
  const hasToolCalls = useMemo(() => {
    if (!messages) return false;
    return messages.some((msg) => msg.parts?.some((p) => p.type === 'tool'));
  }, [messages]);

  // ---- Restore model/agent from last user message ----
  const lastUserMessage = useMemo(
    () =>
      messages
        ? [...messages].reverse().find((m) => m.info.role === 'user')
        : undefined,
    [messages],
  );
  const lastUserMsgIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!lastUserMessage) return;
    if (lastUserMsgIdRef.current === lastUserMessage.info.id) return;
    lastUserMsgIdRef.current = lastUserMessage.info.id;
    const msg = lastUserMessage.info as any;
    if (msg.agent) local.agent.set(msg.agent);
    if (!local.model.hasSessionModel) {
      const parsedModel = parseModelKey(msg.model);
      if (parsedModel) local.model.set(parsedModel, { autoSeed: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMessage?.info.id]);

  // ---- Session status ----
  const syncStatus = useSyncStore((s) => s.sessionStatus[sessionId]);
  const legacyStatus = useOpenCodeSessionStatusStore(
    (s) => s.statuses[sessionId],
  );
  const isOptimisticCompacting = useOpenCodeCompactionStore((s) =>
    Boolean(s.compactingBySession[sessionId]),
  );
  const sessionStatus = syncStatus ?? legacyStatus;
  const isServerBusy =
    sessionStatus?.type === 'busy' || sessionStatus?.type === 'retry';

  const hasIncompleteAssistant = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].info.role === 'assistant') {
        return !(messages[i].info as any).time?.completed;
      }
    }
    return false;
  }, [messages]);
  const hasPendingUserReply = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].info.role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return false;
    for (let i = lastUserIdx + 1; i < messages.length; i++) {
      if (messages[i].info.role === 'assistant') return false;
    }
    return true;
  }, [messages]);
  const expectAssistantResponse =
    isServerBusy ||
    hasPendingUserReply ||
    hasIncompleteAssistant ||
    pendingSendInFlight;

  const effectiveBusy =
    isServerBusy ||
    hasIncompleteAssistant ||
    hasPendingUserReply ||
    pendingSendInFlight ||
    isOptimisticCompacting;

  const [isBusy, setIsBusy] = useState(effectiveBusy);
  const busyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (effectiveBusy) {
      clearTimeout(busyTimerRef.current);
      setIsBusy(true);
    } else {
      busyTimerRef.current = setTimeout(() => setIsBusy(false), 2000);
    }
    return () => clearTimeout(busyTimerRef.current);
  }, [effectiveBusy]);

  const shouldRecoveryPoll = expectAssistantResponse;

  const streamCacheKey = `opencode_stream_cache:${sessionId}`;
  const streamCacheRestoredRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldRecoveryPoll) return;
    if (!messages || messages.length === 0) return;

    let cached: {
      messageID: string;
      parentID?: string;
      partID: string;
      text: string;
      updatedAt: number;
    } | null = null;
    try {
      const raw = sessionStorage.getItem(streamCacheKey);
      cached = raw ? JSON.parse(raw) : null;
    } catch {
      cached = null;
    }
    if (!cached || !cached.messageID || !cached.partID || !cached.text) return;
    if (Date.now() - (cached.updatedAt || 0) > 30 * 60 * 1000) return;
    const cacheFingerprint = `${cached.messageID}:${cached.partID}:${cached.text.length}`;
    if (streamCacheRestoredRef.current === cacheFingerprint) return;

    const store = useSyncStore.getState();
    const currentMsgs = store.getMessages(sessionId);
    let latestUserId: string | undefined;
    for (let i = currentMsgs.length - 1; i >= 0; i--) {
      if (currentMsgs[i].info.role === 'user') {
        latestUserId = currentMsgs[i].info.id;
        break;
      }
    }
    if (hasPendingUserReply) {
      if (
        !cached.parentID ||
        !latestUserId ||
        cached.parentID !== latestUserId
      ) {
        return;
      }
    }
    const hasMsg = currentMsgs.some((m) => m.info.id === cached!.messageID);
    const hasAnyUser = currentMsgs.some((m) => m.info.role === 'user');

    if (!hasMsg) {
      if (!hasAnyUser) return;
      const parentID = cached.parentID ?? latestUserId;
      if (hasPendingUserReply && !parentID) return;
      if (parentID) {
        const parentExists = currentMsgs.some((m) => m.info.id === parentID);
        if (!parentExists) return;
      }
      store.upsertMessage(sessionId, {
        id: cached.messageID,
        sessionID: sessionId,
        role: 'assistant',
        parentID,
      } as any);
    }

    const currentParts = store.parts[cached.messageID] ?? [];
    const existing = currentParts.find((p) => p.id === cached!.partID) as any;
    const existingText =
      typeof existing?.text === 'string' ? existing.text : '';
    if (cached.text.length <= existingText.length) {
      streamCacheRestoredRef.current = cacheFingerprint;
      return;
    }

    streamCacheRestoredRef.current = cacheFingerprint;
    store.upsertPart(cached.messageID, {
      ...(existing ?? {}),
      id: cached.partID,
      messageID: cached.messageID,
      sessionID: sessionId,
      type: 'text',
      text: cached.text,
    } as any);
  }, [
    messages,
    sessionId,
    shouldRecoveryPoll,
    streamCacheKey,
    hasPendingUserReply,
  ]);

  // ---- Message Queue ----
  const queueHydrated = useMessageQueueStore((s) => s.hydrated);
  useEffect(() => {
    if (!queueHydrated) {
      useMessageQueueStore.getState().hydrateFromBackend();
    }
  }, [queueHydrated]);

  const allQueuedMessages = useMessageQueueStore((s) => s.messages);
  const queuedMessages = useMemo(
    () => allQueuedMessages.filter((m) => m.sessionId === sessionId),
    [allQueuedMessages, sessionId],
  );
  const queueDequeue = useMessageQueueStore((s) => s.dequeue);
  const queueRemove = useMessageQueueStore((s) => s.remove);
  const queueMoveUp = useMessageQueueStore((s) => s.moveUp);
  const queueMoveDown = useMessageQueueStore((s) => s.moveDown);
  const queueClearSession = useMessageQueueStore((s) => s.clearSession);
  const [queueExpanded, setQueueExpanded] = useState(true);

  const drainScheduledRef = useRef(false);
  const queueInFlightRef = useRef<{
    queueId: string;
    sentAt: number;
  } | null>(null);
  const hasActiveQuestionForQueue = useOpenCodePendingStore((s) =>
    Object.values(s.questions).some((q) => q.sessionID === sessionId),
  );

  const drainNextWhenSettled = useCallback(() => {
    if (drainScheduledRef.current) return;
    if (queueInFlightRef.current) return;
    if (isBusy) return;
    if (isServerBusy || hasIncompleteAssistant) return;
    if (hasPendingUserReply) return;
    if (pendingSendInFlight) return;
    if (hasActiveQuestionForQueue) return;
    const sessionQueue = useMessageQueueStore
      .getState()
      .messages.filter((m) => m.sessionId === sessionId);
    if (sessionQueue.length === 0) return;
    drainScheduledRef.current = true;
    setTimeout(() => {
      drainScheduledRef.current = false;
      if (
        queueInFlightRef.current ||
        isBusy ||
        isServerBusy ||
        hasIncompleteAssistant ||
        hasPendingUserReply ||
        pendingSendInFlight ||
        hasActiveQuestionForQueue
      )
        return;
      queueInFlightRef.current = {
        queueId: '__scheduling__',
        sentAt: 0,
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const next = queueDequeue(sessionId);
          if (next) {
            queueInFlightRef.current = {
              queueId: next.id,
              sentAt: Date.now(),
            };
            void handleSend(next.text, next.files).catch(() => {
              queueInFlightRef.current = null;
            });
          } else {
            queueInFlightRef.current = null;
          }
        });
      });
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    queueDequeue,
    isBusy,
    isServerBusy,
    hasIncompleteAssistant,
    hasPendingUserReply,
    pendingSendInFlight,
    hasActiveQuestionForQueue,
  ]);

  useEffect(() => {
    const inFlight = queueInFlightRef.current;
    if (!inFlight) return;
    if (
      isBusy ||
      isServerBusy ||
      hasIncompleteAssistant ||
      hasPendingUserReply ||
      pendingSendInFlight ||
      hasActiveQuestionForQueue
    )
      return;
    queueInFlightRef.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => drainNextWhenSettled());
    });
  }, [
    messages,
    isBusy,
    isServerBusy,
    hasIncompleteAssistant,
    hasPendingUserReply,
    pendingSendInFlight,
    hasActiveQuestionForQueue,
    drainNextWhenSettled,
  ]);

  useEffect(() => {
    if (isBusy || drainScheduledRef.current) return;
    const sessionQueue = useMessageQueueStore
      .getState()
      .messages.filter((m) => m.sessionId === sessionId);
    if (sessionQueue.length === 0) return;
    drainNextWhenSettled();
  }, [isBusy, queuedMessages.length, sessionId, drainNextWhenSettled]);

  const handleQueueSendNow = useCallback(
    (messageId: string) => {
      const msg = useMessageQueueStore
        .getState()
        .messages.find((m) => m.id === messageId);
      if (!msg) return;
      queueInFlightRef.current = null;
      queueRemove(messageId);
      abortSession.mutate(sessionId);
      setTimeout(() => {
        handleSend(msg.text, msg.files);
      }, 150);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, abortSession, queueRemove],
  );

  useEffect(() => {
    if (pollingActive && sessionStatus?.type === 'idle') {
      const timeSinceSend = Date.now() - lastSendTimeRef.current;
      if (timeSinceSend < 5000) {
        const remaining = 5000 - timeSinceSend;
        const timer = setTimeout(() => {
          const currentStatus =
            useOpenCodeSessionStatusStore.getState().statuses[sessionId];
          if (currentStatus?.type === 'idle') {
            setPollingActive(false);
          }
        }, remaining);
        return () => clearTimeout(timer);
      }
      setPollingActive(false);
    }
  }, [pollingActive, sessionStatus?.type, sessionId]);

  useEffect(() => {
    if (!pendingSendInFlight) return;
    if (isServerBusy) {
      setPendingSendInFlight(false);
      setPendingSendMessageId(null);
      return;
    }
    const hasAssistantReply = pendingSendMessageId
      ? !!messages?.some(
          (m) =>
            m.info.role === 'assistant' &&
            (m.info as any).parentID === pendingSendMessageId,
        )
      : false;
    if (hasAssistantReply) {
      setPendingSendInFlight(false);
      setPendingSendMessageId(null);
    }
  }, [pendingSendInFlight, isServerBusy, messages, pendingSendMessageId]);

  useEffect(() => {
    if (!pendingSendInFlight) return;
    const timer = setTimeout(() => {
      setPendingSendInFlight(false);
      setPendingSendMessageId(null);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [pendingSendInFlight]);

  // Stale session watchdog
  useEffect(() => {
    if (!isServerBusy) return;

    const check = async () => {
      try {
        const client = getClient();
        const result = await client.session.status();
        if (result.data) {
          const statuses = result.data as Record<string, any>;
          const serverStatus = statuses[sessionId];
          if (serverStatus) {
            useSyncStore.getState().setStatus(sessionId, serverStatus);
            useOpenCodeSessionStatusStore
              .getState()
              .setStatus(sessionId, serverStatus);
          } else {
            const idle = { type: 'idle' as const };
            useSyncStore.getState().setStatus(sessionId, idle);
            useOpenCodeSessionStatusStore.getState().setStatus(sessionId, idle);
          }
        }
      } catch {
        // ignore
      }
    };

    const initialTimer = setTimeout(check, 5_000);
    const interval = setInterval(check, 30_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isServerBusy, sessionId]);

  // Message-based idle detection
  const messageCountForIdle = messages?.length ?? 0;
  useEffect(() => {
    if (!isServerBusy || !messages || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.info.role === 'user') return;

    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].info.role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    const assistantInfo = messages[lastAssistantIdx].info as any;
    if (!assistantInfo.time?.completed) return;

    for (let i = lastAssistantIdx + 1; i < messages.length; i++) {
      if (messages[i].info.role === 'user') return;
    }

    const msgCountAtStart = messages.length;
    const timer = setTimeout(() => {
      const currentMsgs = useSyncStore.getState().getMessages(sessionId);
      if (currentMsgs.length > msgCountAtStart) {
        return;
      }
      const syncStoreStatus = useSyncStore.getState().sessionStatus[sessionId];
      const legacyStoreStatus =
        useOpenCodeSessionStatusStore.getState().statuses[sessionId];
      const currentType = syncStoreStatus?.type ?? legacyStoreStatus?.type;
      if (currentType === 'busy' || currentType === 'retry') {
        const idle = { type: 'idle' as const };
        useSyncStore.getState().setStatus(sessionId, idle);
        useOpenCodeSessionStatusStore.getState().setStatus(sessionId, idle);
      }
    }, 5_000);
    return () => clearTimeout(timer);
  }, [isServerBusy, messages, sessionId, messageCountForIdle]);

  // Post-idle recovery
  const prevBusyForRecoveryRef = useRef(isServerBusy);
  useEffect(() => {
    const wasBusy = prevBusyForRecoveryRef.current;
    prevBusyForRecoveryRef.current = isServerBusy;

    if (!wasBusy || isServerBusy) return;
    if (!messages || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.info.role !== 'user') return;

    const client = getClient();
    client.session
      .messages({ sessionID: sessionId })
      .then((res) => {
        if (res.data) {
          useSyncStore.getState().hydrate(sessionId, res.data as any);
        }
      })
      .catch((error) => {
        logger.warn('Failed to recover messages after busy→idle transition', {
          sessionId,
          error,
        });
      });
  }, [isServerBusy, messages, sessionId]);

  // Clear pending user message when confirmed
  const prevMsgLenRef = useRef(messages?.length || 0);
  useEffect(() => {
    if (!pendingUserMessage) return;
    const hasPendingMessage = pendingUserMessageId
      ? !!messages?.some((m) => m.info.id === pendingUserMessageId)
      : false;
    if (hasPendingMessage) {
      setPendingUserMessage(null);
      setPendingUserMessageId(null);
      setPendingCommand(null);
      return;
    }
    const len = messages?.length || 0;
    if (len > prevMsgLenRef.current) {
      setPendingUserMessage(null);
      setPendingUserMessageId(null);
      setPendingCommand(null);
    }
  }, [messages, messages?.length, pendingUserMessage, pendingUserMessageId]);

  useEffect(() => {
    const stash = pendingCommandStashRef.current;
    if (!stash || !messages) return;
    const len = messages.length;
    if (len <= prevMsgLenRef.current) return;
    for (let i = len - 1; i >= 0; i--) {
      if (messages[i].info.role === 'user') {
        commandMessagesRef.current.set(messages[i].info.id, stash);
        pendingCommandStashRef.current = null;
        break;
      }
    }
  }, [messages]);

  useEffect(() => {
    prevMsgLenRef.current = messages?.length || 0;
  }, [messages?.length]);

  // ---- Auto-scroll ----
  const hasActiveQuestion = useOpenCodePendingStore((s) =>
    Object.values(s.questions).some((q) => q.sessionID === sessionId),
  );
  const messageCount = messages?.length ?? 0;
  const {
    scrollRef,
    contentRef,
    spacerElRef,
    showScrollButton,
    scrollToBottom,
    scrollToLastTurn,
    scrollToEnd,
    scrollToAbsoluteBottom,
    smoothScrollToAbsoluteBottom,
  } = useAutoScroll({
    working: isBusy && !hasActiveQuestion,
    hasContent: messageCount > 0,
  });

  const initialScrollDoneRef = useRef<string | null>(null);
  const scrollContainerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
      if (!node) return;
      if (initialScrollDoneRef.current === sessionId) return;
      initialScrollDoneRef.current = sessionId;

      if (initialScrollTop) {
        node.scrollTop = 0;
        return;
      }

      const scrollNearBottom = () => {
        const max = node.scrollHeight - node.clientHeight;
        node.scrollTop = Math.max(0, max - 300);
      };
      scrollNearBottom();

      setTimeout(() => {
        node.scrollTo({
          top: node.scrollHeight - node.clientHeight,
          behavior: 'smooth',
        });
      }, 150);
      setTimeout(() => {
        node.scrollTo({
          top: node.scrollHeight - node.clientHeight,
          behavior: 'smooth',
        });
      }, 600);
    },
    [sessionId, scrollRef, initialScrollTop],
  );

  // ---- Pending permissions & questions ----
  const allPermissions = useOpenCodePendingStore((s) => s.permissions);
  const allQuestions = useOpenCodePendingStore((s) => s.questions);
  const addQuestion = useOpenCodePendingStore((s) => s.addQuestion);
  const pendingPermissions = useMemo(
    () =>
      Object.values(allPermissions).filter((p) => p.sessionID === sessionId),
    [allPermissions, sessionId],
  );
  const suppressedQuestionIdsRef = useRef<Map<string, number>>(new Map());
  const suppressQuestionFor = useCallback((requestId: string, ms = 15000) => {
    suppressedQuestionIdsRef.current.set(requestId, Date.now() + ms);
  }, []);
  const isQuestionSuppressed = useCallback((requestId: string) => {
    const expiresAt = suppressedQuestionIdsRef.current.get(requestId);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      suppressedQuestionIdsRef.current.delete(requestId);
      return false;
    }
    return true;
  }, []);
  const pendingQuestions = useMemo(
    () =>
      Object.values(allQuestions).filter(
        (q) => q.sessionID === sessionId && !isQuestionSuppressed(q.id),
      ),
    [allQuestions, sessionId, isQuestionSuppressed],
  );
  const QUESTION_PROMPT_ANIMATION_MS = 320;
  const activePendingQuestion = pendingQuestions[0] ?? null;
  const [renderedQuestion, setRenderedQuestion] = useState<
    import('@/ui').QuestionRequest | null
  >(null);
  const [questionPromptVisible, setQuestionPromptVisible] = useState(false);
  const questionPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    const nextQuestion = activePendingQuestion;

    if (questionPromptTimerRef.current) {
      clearTimeout(questionPromptTimerRef.current);
      questionPromptTimerRef.current = null;
    }

    if (nextQuestion) {
      setRenderedQuestion(nextQuestion);
      requestAnimationFrame(() => setQuestionPromptVisible(true));
      return;
    }

    setQuestionPromptVisible(false);
    questionPromptTimerRef.current = setTimeout(() => {
      setRenderedQuestion(null);
      questionPromptTimerRef.current = null;
    }, QUESTION_PROMPT_ANIMATION_MS);
  }, [activePendingQuestion]);

  useEffect(() => {
    return () => {
      if (questionPromptTimerRef.current) {
        clearTimeout(questionPromptTimerRef.current);
      }
    };
  }, []);
  const questionHydrationInFlightRef = useRef(false);
  const lastQuestionHydrationAtRef = useRef(0);
  const hasAnyMessages = !!messages && messages.length > 0;
  const hasChatContent =
    hasAnyMessages || (!!optimisticPrompt && !hasAnyMessages);
  const WELCOME_FADE_MS = 900;
  const [welcomeFadeActive, setWelcomeFadeActive] = useState(false);
  const welcomeFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevHasChatContentRef = useRef(hasChatContent);
  useEffect(() => {
    const hadContent = prevHasChatContentRef.current;
    if (!hadContent && hasChatContent) {
      setWelcomeFadeActive(true);
      if (welcomeFadeTimerRef.current) {
        clearTimeout(welcomeFadeTimerRef.current);
      }
      welcomeFadeTimerRef.current = setTimeout(() => {
        setWelcomeFadeActive(false);
        welcomeFadeTimerRef.current = null;
      }, WELCOME_FADE_MS + 120);
    }
    if (!hasChatContent) {
      setWelcomeFadeActive(false);
    }
    prevHasChatContentRef.current = hasChatContent;
  }, [hasChatContent]);

  useEffect(() => {
    return () => {
      if (welcomeFadeTimerRef.current) {
        clearTimeout(welcomeFadeTimerRef.current);
      }
    };
  }, []);
  const hasRunningQuestionTool = useMemo(() => {
    if (!messages) return false;
    return messages.some((m) => {
      if (m.info.role !== 'assistant') return false;
      return m.parts.some((p) => {
        if (p.type !== 'tool') return false;
        const tool = p as ToolPart;
        if (tool.tool !== 'question') return false;
        return (
          tool.state.status === 'running' || tool.state.status === 'pending'
        );
      });
    });
  }, [messages]);

  // Self-heal missed question events
  useEffect(() => {
    if (!hasRunningQuestionTool || pendingQuestions.length > 0) return;

    const client = getClient();
    let cancelled = false;

    const hydrateQuestions = () => {
      if (questionHydrationInFlightRef.current || cancelled) return;
      const now = Date.now();
      if (now - lastQuestionHydrationAtRef.current < 1500) return;

      questionHydrationInFlightRef.current = true;
      lastQuestionHydrationAtRef.current = now;

      void client.question
        .list()
        .then((res) => {
          if (!res.data || cancelled) return;
          (res.data as any[]).forEach((q) => {
            if (!q?.id || isQuestionSuppressed(q.id)) return;
            addQuestion(q);
          });
        })
        .finally(() => {
          questionHydrationInFlightRef.current = false;
        });
    };

    hydrateQuestions();
    const timer = setInterval(hydrateQuestions, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    hasRunningQuestionTool,
    pendingQuestions.length,
    addQuestion,
    isQuestionSuppressed,
  ]);

  // ---- Permission/question reply handlers ----
  const removePermission = useOpenCodePendingStore((s) => s.removePermission);
  const removeQuestion = useOpenCodePendingStore((s) => s.removeQuestion);

  const handlePermissionReply = useCallback(
    async (requestId: string, reply: 'once' | 'always' | 'reject') => {
      try {
        await replyToPermission(requestId, reply);
        removePermission(requestId);
      } catch {
        // ignore
      }
    },
    [removePermission],
  );

  const handleQuestionReply = useCallback(
    async (requestId: string, answers: string[][]) => {
      const questionReq =
        useOpenCodePendingStore.getState().questions[requestId];

      suppressQuestionFor(requestId);
      removeQuestion(requestId);

      if (questionReq?.tool?.messageID) {
        const { messageID } = questionReq.tool;
        const parts = useSyncStore.getState().parts[messageID];
        if (parts) {
          const match = parts.find(
            (p) =>
              p.type === 'tool' &&
              (p as ToolPart).tool === 'question' &&
              (p as ToolPart).callID === questionReq.tool!.callID,
          );
          if (match) {
            optimisticAnswersCache.set(match.id, {
              answers,
              input:
                ((match as ToolPart).state?.input as Record<string, unknown>) ??
                {},
            });
          }
        }
      }

      try {
        await replyToQuestion(requestId, answers);
      } catch {
        // ignore
      }
    },
    [removeQuestion, suppressQuestionFor],
  );

  const handleQuestionReject = useCallback(
    async (requestId: string) => {
      suppressQuestionFor(requestId);
      removeQuestion(requestId);
      try {
        await rejectQuestion(requestId);
      } catch {
        // ignore
      }
      if (!abortSession.isPending) {
        abortSession.mutate(sessionId);
      }
    },
    [removeQuestion, abortSession, sessionId, suppressQuestionFor],
  );

  // ---- Group messages into turns ----
  const turns = useMemo(
    () => (messages ? groupMessagesIntoTurns(messages) : []),
    [messages],
  );
  const hasCompactionTurn = useMemo(
    () =>
      turns.some(
        (turn) =>
          turn.assistantMessages.some(
            (msg) => (msg.info as any).summary === true,
          ) ||
          turn.assistantMessages.some((msg) =>
            msg.parts.some((p) => p.type === 'compaction'),
          ),
      ),
    [turns],
  );

  // ---- Jump-to-message ----
  const targetMessageId = useMessageJumpStore((s) => s.targetMessageId);
  const clearJumpTarget = useMessageJumpStore((s) => s.clearTarget);
  useEffect(() => {
    if (!targetMessageId) return;
    const contentEl = contentRef.current;
    const scrollEl = scrollRef.current;
    if (!contentEl || !scrollEl) return;

    const target = contentEl.querySelector<HTMLElement>(
      `[data-turn-id="${targetMessageId}"]`,
    );
    if (!target) {
      clearJumpTarget();
      return;
    }

    const scrollRect = scrollEl.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - scrollRect.top + scrollEl.scrollTop - 24;
    scrollEl.scrollTo({
      top: Math.max(0, offset),
      behavior: 'smooth',
    });
    clearJumpTarget();
  }, [targetMessageId, clearJumpTarget, contentRef, scrollRef]);

  // Reset on session change
  useEffect(() => {
    setPollingActive(false);
    setPendingUserMessage(null);
    setPendingUserMessageId(null);
    setPendingCommand(null);
    setPendingSendInFlight(false);
    setPendingSendMessageId(null);
    setIsRetrying(false);
    lastSendTimeRef.current = 0;
  }, [sessionId]);

  // ---- Fork handlers ----
  const handleFork = useCallback(
    async (userMessageId: string) => {
      setConfirmForkMessageId(null);
      const msg = messages?.find((item) => item.info.id === userMessageId);
      const forkedSession = await forkSession.mutateAsync({
        sessionId,
        messageId: userMessageId,
        directory: session?.directory,
        workspace: session?.workspaceID,
      });
      if (msg) stashForkPrompt(forkedSession.id, buildForkPrompt(msg.parts));

      const title = forkedSession.title || 'Forked session';
      openTabAndNavigate({
        id: forkedSession.id,
        title,
        type: 'session',
        href: `/sessions/${forkedSession.id}`,
        serverId: useServerStore.getState().activeServerId,
      });
    },
    [
      sessionId,
      forkSession,
      messages,
      session?.directory,
      session?.workspaceID,
    ],
  );

  const handleEditFork = useCallback(
    async (userMessageId: string, newText: string) => {
      const msg = messages?.find((item) => item.info.id === userMessageId);
      const forkedSession = await forkSession.mutateAsync({
        sessionId,
        messageId: userMessageId,
        directory: session?.directory,
        workspace: session?.workspaceID,
      });
      if (msg)
        stashForkPrompt(forkedSession.id, buildForkPrompt(msg.parts, newText));

      const title = forkedSession.title || 'Forked session';
      openTabAndNavigate({
        id: forkedSession.id,
        title,
        type: 'session',
        href: `/sessions/${forkedSession.id}`,
        serverId: useServerStore.getState().activeServerId,
      });
    },
    [
      sessionId,
      forkSession,
      messages,
      session?.directory,
      session?.workspaceID,
    ],
  );

  // ---- Send / Stop / Command handlers ----
  // NOTE: handleSend is used via closure by drainNextWhenSettled which is
  // defined earlier in this component. The eslint-disable below is intentional.
  const handleSend = useCallback(
    async (
      rawText: string,
      files?: AttachedFile[],
      mentions?: TrackedMention[],
    ) => {
      setCommandError(null);

      let text = rawText;
      if (replyTo) {
        text = `<reply_context>${replyTo.text}</reply_context>\n\n${rawText}`;
        setReplyTo(null);
      }

      playSound('send');
      const messageID = ascendingId('msg');
      const textPartId = ascendingId('prt');
      const remoteFiles = (files ?? []).filter(
        (file): file is Extract<AttachedFile, { kind: 'remote' }> =>
          file.kind === 'remote',
      );
      const localFiles = (files ?? []).filter(
        (file): file is Extract<AttachedFile, { kind: 'local' }> =>
          file.kind === 'local',
      );
      const uploadBatchTs = Date.now();
      const uploadPlans = localFiles.map((af, index) => {
        const safeName = af.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${uploadBatchTs}-${index}-${safeName}`;
        return {
          file: af.file,
          filename: af.file.name,
          mime: af.file.type || 'application/octet-stream',
          uniqueName,
          optimisticPath: `/workspace/uploads/${uniqueName}`,
        };
      });

      const sessionMentionsForOptimistic =
        mentions?.filter((m) => m.kind === 'session' && m.value) ?? [];
      const rawOptimisticSessionIds: typeof sessionMentionsForOptimistic = [];
      const rawOptimisticRegex = /@(ses_[A-Za-z0-9]+)/g;
      let rawOptimisticMatch: RegExpExecArray | null;
      while ((rawOptimisticMatch = rawOptimisticRegex.exec(text)) !== null) {
        const rawId = rawOptimisticMatch[1];
        if (sessionMentionsForOptimistic.some((m) => m.value === rawId))
          continue;
        const found = allSessions?.find((s: any) => s.id === rawId);
        rawOptimisticSessionIds.push({
          kind: 'session',
          label: found?.title || rawId,
          value: rawId,
        });
      }

      const allOptimisticSessionMentions = [
        ...sessionMentionsForOptimistic,
        ...rawOptimisticSessionIds,
      ];
      let optimisticText = text;
      if (uploadPlans.length > 0) {
        const optimisticFileRefs = uploadPlans
          .map(
            (f) =>
              `<file path="${f.optimisticPath}" mime="${f.mime}" filename="${f.filename}">\nThis file has been uploaded and is available at the path above.\n</file>`,
          )
          .join('\n');
        optimisticText = `${optimisticText}\n\n${optimisticFileRefs}`;
      }
      if (remoteFiles.length > 0) {
        const optimisticFileRefs = remoteFiles
          .map(
            (file) =>
              `<file path="${file.filename}" mime="${file.mime}" filename="${file.filename}">\nThis file will be restored from the forked prompt.\n</file>`,
          )
          .join('\n');
        optimisticText = `${optimisticText}\n\n${optimisticFileRefs}`;
      }
      if (allOptimisticSessionMentions.length > 0) {
        const refs = allOptimisticSessionMentions
          .map((m) => `<session_ref id="${m.value}" title="${m.label}" />`)
          .join('\n');
        optimisticText = `${optimisticText}\n\nReferenced sessions (use the session_context tool to fetch details when needed):\n${refs}`;
      }

      addOptimisticUserMessage(messageID, optimisticText, [textPartId]);
      useSyncStore.getState().setStatus(sessionId, { type: 'busy' });

      scrollToBottom();
      setTimeout(() => scrollToBottom(), 100);

      const options: Record<string, unknown> = {};
      if (local.agent.current) options.agent = local.agent.current.name;
      if (local.model.currentKey) options.model = local.model.currentKey;
      if (local.model.variant.current)
        options.variant = local.model.variant.current;

      const textPrompt = {
        id: textPartId,
        type: 'text' as const,
        text,
      };
      const parts: Array<
        | typeof textPrompt
        | {
            type: 'file';
            mime: string;
            url: string;
            filename: string;
          }
      > = [textPrompt];
      parts.push(
        ...remoteFiles.map((file) => ({
          type: 'file' as const,
          mime: file.mime,
          url: file.url,
          filename: file.filename,
        })),
      );

      if (uploadPlans.length > 0) {
        const uploadResults = await Promise.all(
          uploadPlans.map(async (plan) => {
            const uploadBlob = new File([plan.file], plan.uniqueName, {
              type: plan.file.type,
            });
            const results = await uploadFile(uploadBlob, '/workspace/uploads');
            if (!results || results.length === 0) {
              throw new Error(`Failed to upload file: ${plan.filename}`);
            }
            return {
              path: results[0].path,
              mime: plan.mime,
              filename: plan.filename,
            };
          }),
        );
        const uploadedFileRefs = uploadResults
          .map(
            (f) =>
              `<file path="${f.path}" mime="${f.mime}" filename="${f.filename}">\nThis file has been uploaded and is available at the path above.\n</file>`,
          )
          .join('\n');
        textPrompt.text = `${textPrompt.text}\n\n${uploadedFileRefs}`;
      }

      // Session reference hints
      const trackedSessionMentions =
        mentions?.filter((m) => m.kind === 'session' && m.value) ?? [];
      const rawSessionIdMentions: TrackedMention[] = [];
      const rawSessionIdRegex = /@(ses_[A-Za-z0-9]+)/g;
      let rawMatch: RegExpExecArray | null;
      while ((rawMatch = rawSessionIdRegex.exec(textPrompt.text)) !== null) {
        const rawId = rawMatch[1];
        if (trackedSessionMentions.some((m) => m.value === rawId)) continue;
        const found = allSessions?.find((s: any) => s.id === rawId);
        if (found) {
          rawSessionIdMentions.push({
            kind: 'session',
            label: found.title || rawId,
            value: rawId,
          });
        } else {
          rawSessionIdMentions.push({
            kind: 'session',
            label: rawId,
            value: rawId,
          });
        }
      }

      const allSessionMentions = [
        ...trackedSessionMentions,
        ...rawSessionIdMentions,
      ];
      if (allSessionMentions.length > 0) {
        const refs = allSessionMentions
          .map((m) => `<session_ref id="${m.value}" title="${m.label}" />`)
          .join('\n');
        textPrompt.text = `${textPrompt.text}\n\nReferenced sessions (use the session_context tool to fetch details when needed):\n${refs}`;
      }

      const mappedParts = parts.map((p: any) => {
        if (p.type === 'file')
          return {
            type: 'file' as const,
            mime: p.mime,
            url: p.url,
            filename: p.filename,
          };
        return { type: 'text' as const, text: p.text };
      });
      const sendOpts = Object.keys(options).length > 0 ? options : undefined;
      const client = getClient();
      const handleSendError = () => {
        useSyncStore.getState().setStatus(sessionId, { type: 'idle' });
        client.session
          .messages({ sessionID: sessionId })
          .then((res) => {
            if (res.data) {
              useSyncStore.getState().hydrate(sessionId, res.data as any);
              useSyncStore.getState().clearOptimisticMessages(sessionId);
            } else {
              removeOptimisticUserMessage(messageID);
            }
          })
          .catch((error) => {
            logger.warn('Failed to hydrate messages after send error', {
              sessionId,
              error,
            });
            removeOptimisticUserMessage(messageID);
          });
      };
      void client.session
        .promptAsync({
          sessionID: sessionId,
          parts: mappedParts,
          ...(sendOpts?.agent ? { agent: sendOpts.agent } : {}),
          ...(sendOpts?.model ? { model: sendOpts.model } : {}),
          ...(sendOpts?.variant ? { variant: sendOpts.variant } : {}),
        } as any)
        .then((res: any) => {
          if (res?.error) handleSendError();
        })
        .catch(handleSendError);

      return messageID;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sessionId,
      local.agent.current,
      local.model.currentKey,
      local.model.variant.current,
      addOptimisticUserMessage,
      removeOptimisticUserMessage,
      scrollToBottom,
      replyTo,
    ],
  );

  const handleStop = useCallback(() => {
    if (abortSession.isPending) {
      console.log(
        `[handleStop] Ignoring - abort already in flight for session ${sessionId}`,
      );
      return;
    }
    console.log(`[handleStop] Stopping session ${sessionId}`);
    useSyncStore.getState().setStatus(sessionId, { type: 'idle' });
    clearTimeout(busyTimerRef.current);
    setIsBusy(false);

    const store = useSyncStore.getState();
    const msgs = store.messages[sessionId];
    if (msgs) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant' && !(msgs[i] as any).error) {
          store.upsertMessage(sessionId, {
            ...msgs[i],
            error: {
              name: 'AbortError',
              data: { message: 'The operation was aborted.' },
            },
          } as any);
          break;
        }
      }
    }

    abortSession.mutate(sessionId);
  }, [sessionId, abortSession]);

  // ---- Triple-ESC to stop ----
  const [escCount, setEscCount] = useState(0);
  const escDeadlineRef = useRef(0);
  const escFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEscHint = useCallback(() => {
    escDeadlineRef.current = 0;
    setEscCount(0);
    if (escFadeTimerRef.current) {
      clearTimeout(escFadeTimerRef.current);
      escFadeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isBusy) return;

      const active = document.activeElement;
      if (
        active?.closest('[role="dialog"]') ||
        active?.closest('[data-radix-popper-content-wrapper]')
      )
        return;

      e.preventDefault();

      const now = Date.now();
      const withinWindow = now < escDeadlineRef.current;

      if (withinWindow) {
        const currentCount = escDeadlineRef.current ? Math.max(1, escCount) : 0;
        if (currentCount >= 2) {
          clearEscHint();
          handleStop();
        } else {
          setEscCount(2);
          escDeadlineRef.current = now + 4000;
          if (escFadeTimerRef.current) clearTimeout(escFadeTimerRef.current);
          escFadeTimerRef.current = setTimeout(() => {
            escDeadlineRef.current = 0;
            setEscCount(0);
          }, 4000);
        }
      } else {
        setEscCount(1);
        escDeadlineRef.current = now + 4000;
        if (escFadeTimerRef.current) clearTimeout(escFadeTimerRef.current);
        escFadeTimerRef.current = setTimeout(() => {
          escDeadlineRef.current = 0;
          setEscCount(0);
        }, 4000);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBusy, handleStop, clearEscHint, escCount]);

  useEffect(() => {
    if (!isBusy) clearEscHint();
  }, [isBusy, clearEscHint]);

  const commandInFlightRef = useRef(false);

  const handleCommand = useCallback(
    (cmd: Command, args?: string) => {
      if (commandInFlightRef.current) return;
      setCommandError(null);

      playSound('send');
      const label = args ? `/${cmd.name} ${args}` : `/${cmd.name}`;
      const selectedModel = local.model.currentKey
        ? formatModelString(local.model.currentKey)
        : undefined;
      const handleCommandError = (err?: unknown) => {
        setPendingCommand(null);
        setPendingUserMessage(null);
        setPendingUserMessageId(null);
        setPollingActive(false);
        pendingCommandStashRef.current = null;
        useSyncStore.getState().setStatus(sessionId, { type: 'idle' });
        setCommandError(formatCommandError(err));
      };

      setPendingCommand({
        name: cmd.name,
        description: args || cmd.description,
      });
      pendingCommandStashRef.current = {
        name: cmd.name,
        args: args || cmd.description,
      };
      setPendingUserMessage(label);
      setPendingUserMessageId(null);
      setPollingActive(true);
      lastSendTimeRef.current = Date.now();

      commandInFlightRef.current = true;
      const client = getClient();
      void client.session
        .command({
          sessionID: sessionId,
          command: cmd.name,
          arguments: args || '',
          ...(local.agent.current && {
            agent: local.agent.current.name,
          }),
          ...(selectedModel && { model: selectedModel }),
          ...(local.model.variant.current && {
            variant: local.model.variant.current,
          }),
        } as any)
        .then((res: any) => {
          if (res?.error) {
            handleCommandError(res.error);
          }
        })
        .catch(handleCommandError)
        .finally(() => {
          commandInFlightRef.current = false;
        });
      setTimeout(() => scrollToBottom(), 50);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sessionId,
      scrollToBottom,
      local.agent.current,
      local.model.currentKey,
      local.model.variant.current,
    ],
  );

  const handleFileSearch = useCallback(
    async (query: string): Promise<string[]> => {
      try {
        return await searchWorkspaceFiles(query);
      } catch {
        return [];
      }
    },
    [],
  );

  // Thread context for subsessions only
  const { data: parentSessionData } = useOpenCodeSession(
    session?.parentID || '',
  );
  const threadContext = useMemo(() => {
    if (!session?.parentID || !parentSessionData) return undefined;
    return {
      variant: 'thread' as const,
      parentTitle: parentSessionData.title || 'Parent session',
      onBackToParent: () => {
        openTabAndNavigate({
          id: parentSessionData.id,
          title: parentSessionData.title || 'Parent session',
          type: 'session',
          href: `/sessions/${parentSessionData.id}`,
          serverId: useServerStore.getState().activeServerId,
        });
      },
    };
  }, [session?.parentID, parentSessionData]);

  // ---- Loading / Not-found states ----
  const isDataLoading =
    (sessionLoading || messagesLoading) && !optimisticPrompt;
  const isNotFound = !session && !sessionLoading && !optimisticPrompt;

  const hasMessages = messages && messages.length > 0;
  const showOptimistic = !!optimisticPrompt && !hasMessages;
  const isTransitioningFromWelcome =
    !prevHasChatContentRef.current && hasChatContent;
  const shouldShowWelcomeOverlay =
    !hasChatContent || welcomeFadeActive || isTransitioningFromWelcome;

  return (
    <div className="relative flex flex-col h-full bg-background">
      {/* Session header — always mounted */}
      {!hideHeader && (
        <SessionSiteHeader
          sessionId={sessionId}
          sessionTitle={session?.title || 'Untitled'}
          onToggleSidePanel={handleTogglePanel}
          isSidePanelOpen={isSidePanelOpen}
          canOpenSidePanel={hasToolCalls}
          leadingAction={headerLeadingAction}
        />
      )}

      {/* Context modal */}
      <SessionContextModal
        open={contextModalOpen}
        onOpenChange={setContextModalOpen}
        messages={messages}
        session={session}
        providers={providers}
        allSessions={allSessions}
      />

      {/* Content area */}
      {isDataLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <AetherLoader size="small" />
        </div>
      ) : isNotFound ? (
        <div className="flex-1 flex items-center justify-center min-h-0 text-sm text-muted-foreground">
          Session not found
        </div>
      ) : (
        <div ref={chatAreaRef} className="relative flex-1 min-h-0">
          {shouldShowWelcomeOverlay && (
            <div
              className={cn(
                'absolute inset-0 z-20 pointer-events-none transition-opacity ease-out',
                hasChatContent ? 'opacity-0' : 'opacity-100',
              )}
              style={{
                transitionDuration: `${WELCOME_FADE_MS}ms`,
              }}
            >
              <SessionWelcome />
            </div>
          )}
          <div
            ref={scrollContainerCallbackRef}
            className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 bg-background h-full [scroll-behavior:auto]"
            onMouseUp={handleChatMouseUp}
            onMouseDown={handleChatMouseDown}
            onScroll={handleChatScroll}
          >
            <div
              ref={contentRef}
              role="log"
              className="mx-auto max-w-3xl min-w-0 w-full px-3 sm:px-6"
            >
              <div className="flex flex-col gap-12 min-w-0">
                {/* Optimistic user message */}
                {showOptimistic && (
                  <div data-turn-id="optimistic">
                    <div className="flex justify-end">
                      <div className="flex flex-col max-w-[90%] rounded-3xl rounded-br-lg bg-card border overflow-hidden">
                        {(() => {
                          const {
                            cleanText: afterReply,
                            replyContext: optReply,
                          } = parseReplyContext(optimisticPrompt || '');
                          const { cleanText, files } =
                            parseFileReferences(afterReply);
                          return (
                            <>
                              {optReply && (
                                <div className="flex items-center gap-2 mx-3 mt-3 mb-0 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10">
                                  <Reply className="size-3 text-primary/60 flex-shrink-0" />
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {optReply.length > 150
                                      ? `${optReply.slice(0, 150)}...`
                                      : optReply}
                                  </span>
                                </div>
                              )}
                              {files.length > 0 && (
                                <div className="flex gap-2 p-3 pb-0 flex-wrap">
                                  {files.map((f, i) => (
                                    <div
                                      key={i}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GridFileCard
                                        filePath={f.path}
                                        fileName={
                                          f.path.split('/').pop() || f.path
                                        }
                                        onClick={() => openPreview(f.path)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {cleanText && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap px-4 py-3">
                                  <HighlightMentions
                                    text={cleanText}
                                    agentNames={agentNames}
                                    onFileClick={openFileInComputer}
                                  />
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/aether-logomark-white.svg"
                        alt="Aether"
                        className="dark:invert-0 invert flex-shrink-0 h-[14px] w-auto"
                      />
                      {isRetrying && (
                        <span className="text-xs text-amber-500">
                          Retrying connection...
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {isOptimisticCompacting && !hasCompactionTurn && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 py-4 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/80 border border-border/60">
                        <Layers className="size-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                          Compaction
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/aether-logomark-white.svg"
                        alt="Aether"
                        className="dark:invert-0 invert flex-shrink-0 h-[14px] w-auto"
                      />
                      <div className="text-sm text-muted-foreground">
                        Compacting session...
                      </div>
                    </div>
                  </div>
                )}

                {/* Turn-based message rendering */}
                {turns.map((turn, turnIndex) => {
                  const hasCompaction =
                    turn.assistantMessages.some(
                      (msg) => (msg.info as any).summary === true,
                    ) ||
                    turn.assistantMessages.some((msg) =>
                      msg.parts.some((p) => p.type === 'compaction'),
                    );

                  return (
                    <div
                      key={turn.userMessage.info.id}
                      data-turn-id={turn.userMessage.info.id}
                    >
                      {hasCompaction && (
                        <div className="flex items-center gap-3 py-4 my-3">
                          <div className="flex-1 h-px bg-border" />
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/80 border border-border/60">
                            <Layers className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                              Compaction
                            </span>
                          </div>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <SessionTurn
                        turn={turn}
                        allMessages={messages!}
                        sessionId={sessionId}
                        sessionStatus={sessionStatus}
                        permissions={pendingPermissions}
                        questions={pendingQuestions}
                        agentNames={agentNames}
                        isFirstTurn={turnIndex === 0}
                        isBusy={isBusy}
                        isCompaction={hasCompaction}
                        onFork={async (userMessageId) => {
                          setConfirmForkMessageId(userMessageId);
                        }}
                        onEditFork={handleEditFork}
                        providers={providers}
                        commandMessages={commandMessagesRef.current}
                        commands={commands}
                        onPermissionReply={handlePermissionReply}
                      />
                    </div>
                  );
                })}

                {/* Busy indicator when no turns yet */}
                {commandError && (
                  <TurnErrorDisplay errorText={commandError} className="mt-2" />
                )}
                {!showOptimistic && isBusy && turns.length === 0 && (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/aether-logomark-white.svg"
                      alt="Aether"
                      className="dark:invert-0 invert flex-shrink-0 h-[14px] w-auto"
                    />
                  </div>
                )}
              </div>
              {/* Spacer */}
              <div ref={spacerElRef} />
            </div>
          </div>

          {/* Selection "Reply" popup */}
          {selectionPopup && (
            <div
              data-reply-popup
              className="absolute z-50 animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
              style={{
                left: `${selectionPopup.x}px`,
                top: `${selectionPopup.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <Button
                onClick={handleSelectionReply}
                variant="outline"
                size="toolbar"
                className="bg-popover shadow-md"
              >
                <Reply className="size-3.5" />
                Reply
              </Button>
            </div>
          )}

          {/* Chat Minimap */}
          <ChatMinimap
            turns={turns}
            scrollRef={scrollRef}
            contentRef={contentRef}
            messages={messages || []}
          />

          {/* Scroll to bottom FAB */}
          <div
            className={cn(
              'absolute bottom-4 left-1/2 -translate-x-1/2 transition-colors duration-300 ease-out',
              showScrollButton
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95 pointer-events-none',
            )}
          >
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-7 text-xs bg-background/90 border-border/60 shadow-lg"
              onClick={smoothScrollToAbsoluteBottom}
            >
              <ArrowDown className="size-3 mr-1" />
              Scroll to bottom
            </Button>
          </div>
        </div>
      )}

      {/* Input — hidden in read-only mode */}
      {!readOnly && (
        <SessionChatInput
          onSend={async (text, files, mentions) => {
            await handleSend(text, files, mentions);
          }}
          isBusy={isBusy}
          onStop={handleStop}
          escCount={escCount}
          agents={local.agent.list}
          selectedAgent={local.agent.current?.name ?? null}
          onAgentChange={(name) => local.agent.set(name ?? undefined)}
          commands={commands || []}
          onCommand={handleCommand}
          models={local.model.list}
          selectedModel={local.model.currentKey ?? null}
          onModelChange={(m) =>
            local.model.set(m ?? undefined, { recent: true })
          }
          variants={local.model.variant.list}
          selectedVariant={local.model.variant.current ?? null}
          onVariantChange={(v) => local.model.variant.set(v ?? undefined)}
          messages={messages}
          sessionId={sessionId}
          onFileSearch={handleFileSearch}
          providers={providers}
          threadContext={threadContext}
          onContextClick={() => setContextModalOpen(true)}
          replyTo={replyTo}
          onClearReply={handleClearReply}
          lockForQuestion={!!renderedQuestion}
          onCustomAnswer={(text) => {
            questionPromptRef.current?.submitCustomAnswer(text);
          }}
          questionButtonLabel={renderedQuestion ? questionAction.label : null}
          questionCanAct={questionAction.canAct}
          onQuestionAction={() => {
            questionPromptRef.current?.performAction();
          }}
          inputSlot={
            renderedQuestion || queuedMessages.length > 0 ? (
              <>
                {renderedQuestion && (
                  <div
                    className={cn(
                      'overflow-hidden transition-[max-height,opacity,transform] ease-in-out',
                      questionPromptVisible
                        ? 'max-h-[520px] opacity-100 translate-y-0 duration-300'
                        : 'max-h-0 opacity-0 -translate-y-1 duration-320 pointer-events-none',
                    )}
                  >
                    <QuestionPrompt
                      ref={questionPromptRef}
                      request={renderedQuestion}
                      onReply={handleQuestionReply}
                      onReject={handleQuestionReject}
                      onActionChange={handleQuestionActionChange}
                    />
                  </div>
                )}
                {queuedMessages.length > 0 && (
                  <div className="rounded-xl bg-muted/50 overflow-hidden">
                    <Button
                      type="button"
                      onClick={() => setQueueExpanded((v) => !v)}
                      variant="ghost"
                      className="flex items-center gap-2 w-full px-3 py-1.5 h-auto rounded-none justify-start hover:bg-muted/80"
                    >
                      <ListPlus className="size-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1 text-left truncate">
                        {queuedMessages.length} message
                        {queuedMessages.length !== 1 ? 's' : ''} queued
                        {!queueExpanded && queuedMessages.length > 0 && (
                          <span className="text-foreground/80 font-medium">
                            {(() => {
                              const previewText = queuedMessages[0].text.trim();
                              if (previewText.length > 0) {
                                return (
                                  <>
                                    {' '}
                                    · {previewText.slice(0, 50)}
                                    {previewText.length > 50 ? '…' : ''}
                                  </>
                                );
                              }
                              const fileCount =
                                queuedMessages[0].files?.length ?? 0;
                              if (fileCount > 0) {
                                return (
                                  <>
                                    {' '}
                                    · {fileCount} file
                                    {fileCount > 1 ? 's' : ''}
                                  </>
                                );
                              }
                              return null;
                            })()}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            queueClearSession(sessionId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              queueClearSession(sessionId);
                            }
                          }}
                          className="inline-flex items-center justify-center size-5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="size-3" />
                        </span>
                        <ChevronUp
                          className={cn(
                            'size-3 text-muted-foreground/40 transition-transform',
                            !queueExpanded && 'rotate-180',
                          )}
                        />
                      </div>
                    </Button>

                    {queueExpanded && queuedMessages.length > 0 && (
                      <div className="border-t border-border/30 max-h-[160px] overflow-y-auto scrollbar-hide">
                        <div className="flex flex-col px-1.5 py-1">
                          {queuedMessages.map((qm, idx) => (
                            <div
                              key={qm.id}
                              className="group/q flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted/60 transition-colors"
                            >
                              <span className="text-[10px] tabular-nums text-muted-foreground/40 shrink-0 w-3 text-center">
                                {idx + 1}
                              </span>
                              <p className="flex-1 text-xs text-muted-foreground truncate min-w-0">
                                {qm.text ||
                                  `${qm.files?.length ?? 0} file${(qm.files?.length ?? 0) === 1 ? '' : 's'}`}
                              </p>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/q:opacity-100 transition-opacity shrink-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      onClick={() => handleQueueSendNow(qm.id)}
                                      variant="ghost"
                                      size="icon-xs"
                                    >
                                      <Send className="size-2.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="text-xs">Send now</p>
                                  </TooltipContent>
                                </Tooltip>
                                {idx > 0 && (
                                  <Button
                                    type="button"
                                    onClick={() => queueMoveUp(qm.id)}
                                    variant="ghost"
                                    size="icon-xs"
                                  >
                                    <ArrowUp className="size-2.5" />
                                  </Button>
                                )}
                                {idx < queuedMessages.length - 1 && (
                                  <Button
                                    type="button"
                                    onClick={() => queueMoveDown(qm.id)}
                                    variant="ghost"
                                    size="icon-xs"
                                  >
                                    <ArrowDown className="size-2.5" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  onClick={() => queueRemove(qm.id)}
                                  variant="ghost"
                                  size="icon-xs"
                                  className="hover:text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-2.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : undefined
          }
        />
      )}
      <ConfirmForkDialog
        open={!!confirmForkMessageId}
        onOpenChange={(open) => {
          if (!open) setConfirmForkMessageId(null);
        }}
        onConfirm={() => {
          if (!confirmForkMessageId) return;
          void handleFork(confirmForkMessageId);
        }}
        loading={forkSession.isPending}
      />
    </div>
  );
}

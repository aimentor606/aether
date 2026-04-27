'use client';

import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  CircleAlert,
} from 'lucide-react';
import { QuestionPrompt } from '@/components/session/question-prompt';
import { Button } from '@/components/ui/button';
import { ToolRegistry } from './registry';
import {
  BasicTool,
  ToolRunningContext,
  StalePendingContext,
} from './shared';
import { ToolError } from './tool-error';
import { GenericTool } from './generic-tool';
import {
  PERMISSION_LABELS,
  type PermissionRequest,
  type QuestionRequest,
  type ToolPart,
} from '@/ui';

// ============================================================================
// PermissionPromptInline
// ============================================================================

interface PermissionPromptInlineProps {
  permission: PermissionRequest;
  onReply?: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
}

function PermissionPromptInline({
  permission,
  onReply,
}: PermissionPromptInlineProps) {
  const [visible, setVisible] = useState(false);
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const label =
    PERMISSION_LABELS[permission.permission] || permission.permission;

  const handleReply = useCallback(
    (reply: 'once' | 'always' | 'reject') => {
      if (replying) return;
      setReplying(true);
      onReply?.(permission.id, reply);
    },
    [replying, permission.id, onReply],
  );

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
      <span className="text-xs text-foreground flex-1">
        Permission: <span className="font-medium">{label}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          disabled={replying}
          onClick={() => handleReply('reject')}
          variant="muted"
          size="xs"
          className="hover:text-destructive hover:bg-destructive/10"
        >
          Deny
        </Button>
        <Button
          disabled={replying}
          onClick={() => handleReply('always')}
          variant="outline"
          size="xs"
        >
          Allow always
        </Button>
        <Button
          disabled={replying}
          onClick={() => handleReply('once')}
          variant="default"
          size="xs"
        >
          Allow once
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// ToolPartRenderer — main dispatch (primary export)
// ============================================================================

interface ToolPartRendererProps {
  part: ToolPart;
  permission?: PermissionRequest;
  question?: QuestionRequest;
  onPermissionReply?: (
    requestId: string,
    reply: 'once' | 'always' | 'reject',
  ) => void;
  onQuestionReply?: (requestId: string, answers: string[][]) => void;
  onQuestionReject?: (requestId: string) => void;
  defaultOpen?: boolean;
}

export function ToolPartRenderer({
  part,
  sessionId,
  permission,
  question,
  onPermissionReply,
  onQuestionReply,
  onQuestionReject,
  defaultOpen,
}: ToolPartRendererProps & { sessionId?: string }) {
  // Skip todoread
  if (part.tool === 'todoread') return null;

  // Error state — show within a proper tool wrapper with the tool name
  if (part.state.status === 'error' && 'error' in part.state) {
    const errorStr = (part.state as { error: string }).error;
    const { display, server } = (() => {
      const slashIdx = part.tool.lastIndexOf('/');
      const s = slashIdx > 0 ? part.tool.slice(0, slashIdx) : null;
      const n = slashIdx > 0 ? part.tool.slice(slashIdx + 1) : part.tool;
      const d = n
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { display: d, server: s };
    })();

    return (
      <BasicTool
        icon={
          <CircleAlert className="size-3.5 flex-shrink-0 text-muted-foreground/70" />
        }
        trigger={
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-medium text-xs text-foreground whitespace-nowrap">
              {display}
            </span>
            {server && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 font-mono whitespace-nowrap">
                {server}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium ml-auto flex-shrink-0">
              Error
            </span>
          </div>
        }
      >
        <div className="p-0">
          <ToolError error={errorStr} toolName={part.tool} />
        </div>
      </BasicTool>
    );
  }

  // Look up registered component
  const RegisteredComponent = ToolRegistry.get(part.tool);
  const forceOpen = !!permission || !!question;
  const isLocked = !!permission || !!question;

  // A tool part is "stale pending" when the backend sent a pending state
  // with empty input/raw and never followed up with running/completed.
  // This happens when the session ends abruptly. Don't show a spinner for these.
  const isStalePending =
    part.state.status === 'pending' &&
    Object.keys(part.state.input ?? {}).length === 0 &&
    !(part.state as any).raw;

  const isRunning =
    !isStalePending &&
    (part.state.status === 'running' || part.state.status === 'pending');

  const toolElement = RegisteredComponent ? (
    <RegisteredComponent
      part={part}
      sessionId={sessionId}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={isLocked}
      hasActiveQuestion={!!question}
      onPermissionReply={onPermissionReply}
    />
  ) : (
    <GenericTool part={part} />
  );

  return (
    <ToolRunningContext.Provider value={isRunning}>
      <StalePendingContext.Provider value={isStalePending}>
        <div className="relative">
          {toolElement}

          {/* Permission prompt */}
          {permission && onPermissionReply && (
            <div className="mt-1.5">
              <PermissionPromptInline
                permission={permission}
                onReply={onPermissionReply}
              />
            </div>
          )}

          {/* Question prompt (renders inside tool part, matching SolidJS reference) */}
          {question && onQuestionReply && onQuestionReject && (
            <div className="mt-1.5">
              <QuestionPrompt
                request={question}
                onReply={onQuestionReply}
                onReject={onQuestionReject}
              />
            </div>
          )}
        </div>
      </StalePendingContext.Provider>
    </ToolRunningContext.Provider>
  );
}

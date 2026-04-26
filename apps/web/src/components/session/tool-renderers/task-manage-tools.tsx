'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  BookOpen,
  Check,
  Circle,
  ExternalLink,
  Loader2,
  ListTodo,
  Trash2,
  X,
} from 'lucide-react';
import { HighlightedCode, UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  MD_FLUSH_CLASSES,
  partInput,
  partOutput,
  partStatus,
  BasicTool,
  ToolRunningContext,
} from './shared';

// ============================================================================
// Task Tools — inline compact chips, visible at a glance
// ============================================================================

function TaskCreateTool({ part }: ToolProps) {
  const input = partInput(part);
  const title = (input.title as string) || '';
  const priority = (input.priority as string) || 'medium';
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/40">
      <Circle className="size-3 text-muted-foreground/40 flex-shrink-0" />
      <span className="text-foreground/80 truncate flex-1">{title}</span>
      {priority === 'high' && (
        <span className="text-[0.5625rem] font-medium text-foreground/50 bg-muted/60 px-1.5 py-px rounded">
          high
        </span>
      )}
    </div>
  );
}
ToolRegistry.register('task_create', TaskCreateTool);
ToolRegistry.register('task-create', TaskCreateTool);

function TaskListTool({ part }: ToolProps) {
  const output = partOutput(part);
  return (
    <BasicTool
      icon={<ListTodo className="size-3.5 flex-shrink-0" />}
      trigger={{ title: 'Tasks', subtitle: '', args: [] }}
      defaultOpen={false}
    >
      {output && (
        <div data-scrollable className="max-h-48 overflow-auto px-3 py-2">
          <div className="text-[11px] text-muted-foreground whitespace-pre-wrap">
            <UnifiedMarkdown content={output} isStreaming={false} />
          </div>
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('task_list', TaskListTool);
ToolRegistry.register('task-list', TaskListTool);

function TaskUpdateTool({ part }: ToolProps) {
  // task_update is internal bookkeeping — hide it entirely.
  // The agent_spawn card already shows task status and description.
  return null;
}
ToolRegistry.register('task_update', TaskUpdateTool);
ToolRegistry.register('task-update', TaskUpdateTool);

function TaskDoneTool({ part }: ToolProps) {
  const input = partInput(part);
  const result = (input.result as string) || '';
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/40">
      <Check className="size-3 text-muted-foreground/50 flex-shrink-0" />
      <span className="text-muted-foreground truncate flex-1">
        {result || 'Completed'}
      </span>
    </div>
  );
}
ToolRegistry.register('task_done', TaskDoneTool);
ToolRegistry.register('task-done', TaskDoneTool);

function TaskDeleteTool({ part }: ToolProps) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground/40">
      <Trash2 className="size-3 flex-shrink-0" />
      <span>Task removed</span>
    </div>
  );
}
ToolRegistry.register('task_delete', TaskDeleteTool);
ToolRegistry.register('task-delete', TaskDeleteTool);

// ============================================================================
// SkillTool — Skill loading
// ============================================================================

/** Extract content from <skill_content> XML wrapper */
function extractSkillContent(output: string): string {
  const match = output.match(/<skill_content[^>]*>([\s\S]*?)<\/skill_content>/);
  return match ? match[1].trim() : output;
}

/** Extract skill files list from output */
function extractSkillFiles(output: string): string[] {
  const filesMatch = output.match(/<skill_files>([\s\S]*?)<\/skill_files>/);
  if (!filesMatch) return [];
  const fileRegex = /<file>(.*?)<\/file>/g;
  const files: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fileRegex.exec(filesMatch[1])) !== null) {
    files.push(m[1].trim());
  }
  return files;
}

function SkillTool({ part, forceOpen }: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const rawOutput = (part.state as any).output ?? '';
  const output = String(rawOutput);

  const skillName = (input.name as string) || 'skill';
  const skillDir = (input.dir as string) || '';

  // Extract skill content for modal
  const skillContent = useMemo(() => extractSkillContent(output), [output]);
  const skillFiles = useMemo(() => extractSkillFiles(output), [output]);

  // Clean markdown content (strip file list block)
  const markdownContent = useMemo(() => {
    return skillContent
      .replace(/<skill_files>[\s\S]*?<\/skill_files>/, '')
      .replace(/Base directory:.*$/m, '')
      .replace(/Note:.*relative to the base directory.*$/m, '')
      .trim();
  }, [skillContent]);

  const [modalOpen, setModalOpen] = useState(false);

  const isRunning = status === 'running' || status === 'pending';
  const isCompleted = status === 'completed';
  const locationLabel = useMemo(() => {
    if (!skillDir) return null;
    const parts = skillDir.split('/').filter(Boolean);
    return parts.slice(-2).join('/') || skillDir;
  }, [skillDir]);

  // Generate a brief summary from skill content (first paragraph, skip the title line)
  const description = useMemo(() => {
    const lines = markdownContent.split('\n');
    // Skip first line if it's a heading (# Skill Name)
    const startIdx = lines[0]?.startsWith('# ') ? 1 : 0;
    const content = lines.slice(startIdx).join('\n').trim();
    const firstPara = content.split('\n\n')[0]?.trim();
    if (!firstPara) return null;
    // Truncate if too long
    if (firstPara.length > 100) {
      return firstPara.slice(0, 100).trim() + '...';
    }
    return firstPara;
  }, [markdownContent]);

  const running = useContext(ToolRunningContext);

  // Clean skill content for the modal display
  const modalContent = useMemo(() => {
    return `# ${skillName}\n\n${skillDir ? `*Location: ${skillDir}*\n\n` : ''}${markdownContent}${skillFiles.length > 0 ? `\n\n---\n\n**Skill Files:**\n${skillFiles.map((f) => `- \`${f}\``).join('\n')}` : ''}`;
  }, [skillName, skillDir, markdownContent, skillFiles]);

  return (
    <>
      {/* Skill card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
          'bg-muted/20 border border-border/40',
          'text-xs transition-colors select-none cursor-pointer hover:bg-muted/40',
          'max-w-full group',
        )}
      >
        <BookOpen className="size-3.5 flex-shrink-0 text-muted-foreground" />

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Skill · {skillName}
          </span>
          {isRunning ? (
            <TextShimmer
              duration={1}
              spread={2}
              className="text-xs truncate font-mono"
            >
              Loading skill instructions
            </TextShimmer>
          ) : description ? (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {description}
            </span>
          ) : locationLabel ? (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {locationLabel}
            </span>
          ) : null}

          {isCompleted && skillFiles.length > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 font-mono whitespace-nowrap flex-shrink-0">
              {skillFiles.length} files
            </span>
          )}
        </div>

        {running ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground/40 flex-shrink-0" />
        ) : (
          <ExternalLink className="size-3 flex-shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        )}
      </div>

      {/* Modal with full skill content */}
      {modalOpen && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent
            hideCloseButton
            className={cn(
              'flex flex-col p-0 gap-0 overflow-hidden',
              'w-[90vw] max-w-3xl h-[80vh] max-h-[800px]',
            )}
            aria-describedby={undefined}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30 shrink-0">
              <BookOpen className="size-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-sm font-medium truncate">
                  {skillName}
                </DialogTitle>
                {skillDir && (
                  <p className="text-xs text-muted-foreground truncate">
                    {skillDir}
                  </p>
                )}
              </div>
              {isCompleted && skillFiles.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 font-mono">
                  {skillFiles.length} file{skillFiles.length !== 1 ? 's' : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={cn(
                  'flex items-center justify-center size-6 rounded-md',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
                )}
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className={cn('flex-1 overflow-auto p-5', MD_FLUSH_CLASSES)}>
              <UnifiedMarkdown content={modalContent} isStreaming={false} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
ToolRegistry.register('skill', SkillTool);

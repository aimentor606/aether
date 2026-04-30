'use client';

import type { PromptPart } from '@/hooks/opencode/use-opencode-sessions';
import type { Part, TextPart } from '@/ui';
import { isFilePart, isTextPart } from '@/ui';
import type {
  AgentCompletedNotification,
  DCPNotification,
  DCPPrunedItem,
  ParsedFileRef,
  ParsedSessionRef,
  PtyExitedNotification,
} from './types';

// ============================================================================
// Optimistic answers cache
// ============================================================================
// When a user answers a question, we save the answers here immediately.
// This survives SSE `message.part.updated` events that may overwrite the
// tool part's state before the server has merged the answers.  The cache
// is keyed by the question tool part's `id` (stable across updates).
// Entries are cleaned up once the server's authoritative part arrives with
// real `metadata.answers`.

export const optimisticAnswersCache = new Map<
  string,
  { answers: string[][]; input: Record<string, unknown> }
>();

// ============================================================================
// Fork prompt helpers
// ============================================================================

export function forkDraftKey(sessionId: string) {
  return `opencode_fork_prompt:${sessionId}`;
}

export function buildForkPrompt(parts: Part[], text?: string): PromptPart[] {
  const next: PromptPart[] = [];
  const value =
    text ??
    parts.find(
      (part): part is TextPart =>
        isTextPart(part) && !part.synthetic && !part.ignored,
    )?.text ??
    '';
  if (value) next.push({ type: 'text', text: value });
  for (const part of parts) {
    if (!isFilePart(part) || !part.url) continue;
    next.push({
      type: 'file',
      mime: part.mime || 'application/octet-stream',
      url: part.url,
      filename: part.filename,
    });
  }
  return next;
}

export function stashForkPrompt(sessionId: string, prompt: PromptPart[]) {
  if (typeof window === 'undefined' || prompt.length === 0) return;
  sessionStorage.setItem(forkDraftKey(sessionId), JSON.stringify(prompt));
}

// ============================================================================
// Parse answers from the question tool's output string
// ============================================================================

export function parseAnswersFromOutput(
  output: string,
  input?: { questions?: Array<{ question: string }> },
): string[][] | null {
  if (!output) return null;

  const questions = input?.questions;
  if (!questions || questions.length === 0) return null;

  // Try to extract "question"="answer" pairs from the output
  const pairRegex = /"([^"]*)"="([^"]*)"/g;
  const pairs: { question: string; answer: string }[] = [];
  let match;
  while ((match = pairRegex.exec(output)) !== null) {
    pairs.push({ question: match[1], answer: match[2] });
  }

  if (pairs.length > 0) {
    // Match pairs to input questions by order (they correspond 1:1)
    return questions.map((_, i) => {
      const pair = pairs[i];
      return pair ? [pair.answer] : [];
    });
  }

  // Fallback: if we can't parse pairs but the output mentions "answered",
  // return a placeholder to indicate the question was answered
  if (output.toLowerCase().includes('answered')) {
    return questions.map(() => ['Answered']);
  }

  return null;
}

// ============================================================================
// Command error formatting
// ============================================================================

export function formatCommandError(errorLike: unknown): string {
  const err = errorLike as any;
  const root = err?.data ?? err;
  const data = root?.data;
  const directMessage =
    root?.message ||
    err?.message ||
    root?.error ||
    err?.error ||
    (typeof err === 'string' ? err : '');

  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  if (root?.name === 'ProviderModelNotFoundError') {
    const providerID =
      typeof data?.providerID === 'string' && data.providerID
        ? data.providerID
        : 'selected provider';
    const modelID =
      typeof data?.modelID === 'string' && data.modelID
        ? data.modelID
        : 'selected model';
    if (providerID === '[object Object]') {
      return 'Invalid model selection was sent to the command endpoint. Please reselect a model and try again.';
    }
    return `Model ${modelID} was not found for provider ${providerID}.`;
  }

  if (typeof root?.name === 'string' && root.name) {
    return root.name;
  }

  if (typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return 'Command failed';
    }
  }

  return 'Command failed';
}

// ============================================================================
// Parse <file> XML references from uploaded file text parts
// ============================================================================

const FILE_TAG_REGEX =
  /<file\s+path="([^"]*?)"\s+mime="([^"]*?)"\s+filename="([^"]*?)">\s*[\s\S]*?<\/file>/g;

export function parseFileReferences(text: string): {
  cleanText: string;
  files: ParsedFileRef[];
} {
  const files: ParsedFileRef[] = [];
  const cleanText = text
    .replace(FILE_TAG_REGEX, (_, path, mime, filename) => {
      files.push({ path, mime, filename });
      return '';
    })
    .trim();
  return { cleanText, files };
}

// ============================================================================
// Parse <session_ref> XML tags from session mention text parts
// ============================================================================

export function parseSessionReferences(text: string): {
  cleanText: string;
  sessions: ParsedSessionRef[];
} {
  const sessions: ParsedSessionRef[] = [];
  let cleaned = text.replace(
    /<session_ref\s+id="([^"]*?)"\s+title="([^"]*?)"\s*\/>/g,
    (_, id, title) => {
      sessions.push({ id, title });
      return '';
    },
  );
  // Strip the instruction header text
  cleaned = cleaned
    .replace(
      /\n*Referenced sessions \(use the session_context tool to fetch details when needed\):\n?/g,
      '',
    )
    .trim();
  return { cleanText: cleaned, sessions };
}

// ============================================================================
// Parse <reply_context> XML from select-and-reply feature
// ============================================================================

export function parseReplyContext(text: string): {
  cleanText: string;
  replyContext: string | null;
} {
  const match = text.match(/<reply_context>([\s\S]*?)<\/reply_context>/);
  if (!match) return { cleanText: text, replyContext: null };
  const replyContext = match[1].trim();
  const cleanText = text
    .replace(/<reply_context>[\s\S]*?<\/reply_context>\s*/, '')
    .trim();
  return { cleanText, replyContext };
}

// ============================================================================
// DCP notification parsing
// ============================================================================

const DCP_TAG_REGEX =
  /<dcp-notification\s+([^>]*)>([\s\S]*?)<\/dcp-notification>/g;
const DCP_ITEM_REGEX =
  /<dcp-item\s+tool="([^"]*?)"\s+description="([^"]*?)"\s*\/>/g;
const DCP_DISTILLED_REGEX = /<dcp-distilled>([\s\S]*?)<\/dcp-distilled>/;
const DCP_SUMMARY_REGEX = /<dcp-summary>([\s\S]*?)<\/dcp-summary>/;

function unescapeXml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}="([^"]*?)"`);
  const m = attrs.match(re);
  return m ? unescapeXml(m[1]) : undefined;
}

// Legacy DCP format: "▣ DCP | ~12.5K tokens saved total" (pre-XML version)
const DCP_LEGACY_REGEX = /^▣ DCP \| ~([\d.]+K?) tokens saved total/;
const DCP_LEGACY_PRUNING_REGEX =
  /▣ Pruning \(~([\d.]+K?) tokens(?:, distilled ([\d.]+K?) tokens)?\)(?:\s*—\s*(.+))?/;
const DCP_LEGACY_ITEM_REGEX = /→\s+(\S+?):\s+(.+)/g;

export const PTY_EXITED_BLOCK_REGEX = /<pty_exited>[\s\S]*?<\/pty_exited>/gi;
export const PTY_FAILURE_HINT_REGEX =
  /Process failed\.\s*Use pty_read with the pattern parameter to search for errors in the output\.?/gi;

export const AGENT_COMPLETED_BLOCK_REGEX =
  /<agent_(?:completed|failed|stopped)>[\s\S]*?<\/agent_(?:completed|failed|stopped)>/gi;

function parseLegacyDCPNotification(text: string): DCPNotification | null {
  const headerMatch = text.match(DCP_LEGACY_REGEX);
  if (!headerMatch) return null;

  const tokenStr = headerMatch[1];
  const tokensSaved = tokenStr.endsWith('K')
    ? Math.round(parseFloat(tokenStr.slice(0, -1)) * 1000)
    : parseInt(tokenStr, 10);

  const pruningMatch = text.match(DCP_LEGACY_PRUNING_REGEX);
  let batchSaved = 0;
  let extractedTokens = 0;
  let reason: string | undefined;
  if (pruningMatch) {
    const batchStr = pruningMatch[1];
    batchSaved = batchStr.endsWith('K')
      ? Math.round(parseFloat(batchStr.slice(0, -1)) * 1000)
      : parseInt(batchStr, 10);
    if (pruningMatch[2]) {
      const extStr = pruningMatch[2];
      extractedTokens = extStr.endsWith('K')
        ? Math.round(parseFloat(extStr.slice(0, -1)) * 1000)
        : parseInt(extStr, 10);
    }
    reason = pruningMatch[3]?.trim();
  }

  const items: DCPPrunedItem[] = [];
  let itemMatch;
  DCP_LEGACY_ITEM_REGEX.lastIndex = 0;
  while ((itemMatch = DCP_LEGACY_ITEM_REGEX.exec(text)) !== null) {
    items.push({ tool: itemMatch[1], description: itemMatch[2].trim() });
  }

  // Check for compress format
  const isCompress = text.includes('▣ Compressing');

  return {
    type: isCompress ? 'compress' : 'prune',
    tokensSaved,
    batchSaved,
    prunedCount: items.length,
    extractedTokens,
    reason,
    items,
  };
}

export function parseDCPNotifications(text: string): {
  cleanText: string;
  notifications: DCPNotification[];
} {
  const notifications: DCPNotification[] = [];

  // First try XML format
  const cleanText = text
    .replace(DCP_TAG_REGEX, (_, attrs: string, body: string) => {
      const type = (parseAttr(attrs, 'type') || 'prune') as
        | 'prune'
        | 'compress';
      const tokensSaved = parseInt(parseAttr(attrs, 'tokens-saved') || '0', 10);
      const batchSaved = parseInt(parseAttr(attrs, 'batch-saved') || '0', 10);
      const prunedCount = parseInt(parseAttr(attrs, 'pruned-count') || '0', 10);
      const extractedTokens = parseInt(
        parseAttr(attrs, 'extracted-tokens') || '0',
        10,
      );
      const reason = parseAttr(attrs, 'reason');

      // Parse items
      const items: DCPPrunedItem[] = [];
      let itemMatch;
      DCP_ITEM_REGEX.lastIndex = 0;
      while ((itemMatch = DCP_ITEM_REGEX.exec(body)) !== null) {
        items.push({
          tool: unescapeXml(itemMatch[1]),
          description: unescapeXml(itemMatch[2]),
        });
      }

      // Parse distilled
      const distilledMatch = body.match(DCP_DISTILLED_REGEX);
      const distilled = distilledMatch
        ? unescapeXml(distilledMatch[1])
        : undefined;

      // Compress-specific
      const messagesCount =
        parseInt(parseAttr(attrs, 'messages-count') || '0', 10) || undefined;
      const toolsCount =
        parseInt(parseAttr(attrs, 'tools-count') || '0', 10) || undefined;
      const topic = parseAttr(attrs, 'topic');
      const summaryMatch = body.match(DCP_SUMMARY_REGEX);
      const summary = summaryMatch ? unescapeXml(summaryMatch[1]) : undefined;

      notifications.push({
        type,
        tokensSaved,
        batchSaved,
        prunedCount,
        extractedTokens,
        reason,
        items,
        distilled,
        messagesCount,
        toolsCount,
        topic,
        summary,
      });
      return '';
    })
    .trim();

  // If no XML notifications found, try legacy format
  if (notifications.length === 0 && cleanText) {
    const legacy = parseLegacyDCPNotification(cleanText);
    if (legacy) {
      notifications.push(legacy);
      return { cleanText: '', notifications };
    }
  }

  return { cleanText, notifications };
}

// ============================================================================
// PTY exited notification parsing
// ============================================================================

export function parsePtyExitedNotifications(text: string): {
  cleanText: string;
  notifications: PtyExitedNotification[];
} {
  const notifications: PtyExitedNotification[] = [];
  const cleanText = text
    .replace(PTY_EXITED_BLOCK_REGEX, (full) => {
      const body = full.replace(/<\/?pty_exited>/gi, '').trim();
      const getField = (label: string) => {
        const m = body.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
        return m?.[1]?.trim();
      };
      notifications.push({
        id: getField('ID'),
        description: getField('Description'),
        exitCode: getField('Exit Code'),
        outputLines: getField('Output Lines'),
        lastLine: getField('Last Line'),
      });
      return '';
    })
    .replace(PTY_FAILURE_HINT_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, notifications };
}

// ============================================================================
// Agent completed notification parsing
// ============================================================================

export function parseAgentCompletedNotifications(text: string): {
  cleanText: string;
  notifications: AgentCompletedNotification[];
} {
  const notifications: AgentCompletedNotification[] = [];
  const cleanText = text
    .replace(AGENT_COMPLETED_BLOCK_REGEX, (full) => {
      const body = full
        .replace(/<\/?agent_(?:completed|failed|stopped)>/gi, '')
        .trim();
      const getField = (label: string) => {
        const m = body.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
        return m?.[1]?.trim();
      };
      notifications.push({
        agentId: getField('Agent'),
        task: getField('Task'),
        sessionId: getField('Session'),
        status: getField('Status'),
        error: getField('Error'),
        summary: body,
      });
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { cleanText, notifications };
}

// ============================================================================
// Strip system PTY text
// ============================================================================

import { stripAetherSystemTags } from '@/lib/utils/aether-system-tags';

export function stripSystemPtyText(text: string): string {
  if (!text) return '';
  return stripAetherSystemTags(text)
    .replace(PTY_EXITED_BLOCK_REGEX, ' ')
    .replace(PTY_FAILURE_HINT_REGEX, ' ')
    .replace(AGENT_COMPLETED_BLOCK_REGEX, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// DCP token formatting
// ============================================================================

export function formatDCPTokens(tokens: number): string {
  if (tokens >= 1000) {
    const k = (tokens / 1000).toFixed(1).replace('.0', '');
    return `${k}K`;
  }
  return tokens.toString();
}

// ============================================================================
// Command detection from text
// ============================================================================

import type { Command } from '@/ui';

/**
 * Detect if user message text matches a known command template.
 * Returns the command name + extracted args, or undefined if no match.
 */
export function detectCommandFromText(
  rawText: string,
  commands?: Command[],
): { name: string; args?: string } | undefined {
  if (!commands || !rawText) return undefined;

  const trimmedRawText = rawText.trim();
  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const cmd of commands) {
    if (!cmd.template) continue;
    const tpl = cmd.template.trim();

    // For large templates (e.g. onboarding.md), skip regex entirely and do a
    // fast exact-match
    if (tpl.length > 2000) {
      const tplBody = tpl.replace(/\s*\$ARGUMENTS\s*$/, '').trimEnd();
      if (tplBody.length > 0 && trimmedRawText === tplBody) {
        return { name: cmd.name, args: undefined };
      }
      if (tplBody.length > 0 && trimmedRawText.startsWith(tplBody)) {
        const after = trimmedRawText.slice(tplBody.length).trim();
        return {
          name: cmd.name,
          args: after.length > 0 && after.length < 200 ? after : undefined,
        };
      }
      continue;
    }

    // Find the first placeholder position ($1, $2, ..., $ARGUMENTS)
    const placeholderMatch = tpl.match(/\$(\d+|\bARGUMENTS\b)/);
    const prefix = placeholderMatch
      ? tpl.slice(0, placeholderMatch.index).trimEnd()
      : tpl.trimEnd();

    // Require a meaningful prefix (at least 20 chars) to avoid false positives
    if (prefix.length < 20) continue;

    if (trimmedRawText.startsWith(prefix)) {
      let args: string | undefined;
      if (placeholderMatch) {
        const afterPrefix = trimmedRawText.slice(prefix.length).trim();
        const lastNewlineBlock = afterPrefix.split('\n\n').pop()?.trim();
        if (lastNewlineBlock && lastNewlineBlock.length < 200) {
          args = lastNewlineBlock;
        }
      }
      return { name: cmd.name, args };
    }

    // Fallback: robust full-template match where placeholders are wildcards.
    const placeholderRegex = /\$(\d+|\bARGUMENTS\b)/g;
    const placeholderOrder: string[] = [];
    let regexSource = '^';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = placeholderRegex.exec(tpl)) !== null) {
      regexSource += escapeRegExp(tpl.slice(lastIndex, match.index));
      regexSource += '([\\s\\S]*?)';
      placeholderOrder.push(match[1]);
      lastIndex = match.index + match[0].length;
    }

    regexSource += escapeRegExp(tpl.slice(lastIndex));
    regexSource += '$';

    let fullTemplateMatch: RegExpMatchArray | null;
    try {
      fullTemplateMatch = trimmedRawText.match(new RegExp(regexSource));
    } catch {
      continue;
    }
    if (!fullTemplateMatch) continue;

    let args: string | undefined;
    const captures = fullTemplateMatch
      .slice(1)
      .map((value) => value?.trim() ?? '');
    const argumentsIndex = placeholderOrder.findIndex(
      (name) => name.toUpperCase() === 'ARGUMENTS',
    );
    const bestCapture =
      (argumentsIndex >= 0 ? captures[argumentsIndex] : undefined) ||
      captures.find((value) => value.length > 0);
    if (bestCapture && bestCapture.length < 200) {
      args = bestCapture;
    }

    return { name: cmd.name, args };
  }
  return undefined;
}

// ============================================================================
// Markdown helpers
// ============================================================================

/**
 * Strip the incomplete trailing table row while streaming so the markdown
 * parser doesn't render broken borders / pipe characters.
 */
export function trimIncompleteTableRow(text: string): string {
  if (!text.includes('|')) return text;

  const lines = text.split('\n');
  while (lines.length > 0) {
    const last = lines[lines.length - 1];
    const trimmed = last.trim();
    if (trimmed === '') break;
    if (trimmed.startsWith('|') && !trimmed.endsWith('|')) {
      lines.pop();
    } else {
      break;
    }
  }
  return lines.join('\n');
}

export function closeUnterminatedCodeFence(text: string): string {
  if (!text) return text;
  const lines = text.split('\n');
  let fenceCount = 0;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      fenceCount++;
    }
  }
  if (fenceCount % 2 === 0) return text;
  return `${text}\n\n\`\`\``;
}

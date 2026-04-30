'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { openTabAndNavigate } from '@/stores/tab-store';
import { useServerStore } from '@/stores/server-store';
import { parseSessionReferences } from './utils';

export function HighlightMentions({
  text,
  agentNames,
  onFileClick,
}: {
  text: string;
  agentNames?: string[];
  onFileClick?: (path: string) => void;
}) {
  // Strip session ref XML before processing mentions
  const { cleanText, sessions } = useMemo(
    () => parseSessionReferences(text),
    [text],
  );

  const segments = useMemo(() => {
    if (!cleanText)
      return [
        {
          text: cleanText,
          type: undefined as 'file' | 'agent' | 'session' | undefined,
        },
      ];

    // Detect session @mentions first (titles can contain spaces)
    type MentionType = 'file' | 'agent' | 'session';
    const sessionDetected: { start: number; end: number; type: MentionType }[] =
      [];
    for (const s of sessions) {
      const needle = `@${s.title}`;
      const idx = cleanText.indexOf(needle);
      if (idx !== -1) {
        sessionDetected.push({
          start: idx,
          end: idx + needle.length,
          type: 'session',
        });
      }
    }

    const agentSet = new Set(agentNames || []);
    const mentionRegex = /@(\S+)/g;
    const detected: { start: number; end: number; type: MentionType }[] = [
      ...sessionDetected,
    ];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(cleanText)) !== null) {
      const mStart = match.index;
      // Skip if overlaps with a session mention
      if (sessionDetected.some((s) => mStart >= s.start && mStart < s.end))
        continue;
      const name = match[1];
      // Treat @ses_<id> tokens as session mentions
      const type: MentionType = name.startsWith('ses_')
        ? 'session'
        : agentSet.has(name)
          ? 'agent'
          : 'file';
      detected.push({
        start: mStart,
        end: match.index + match[0].length,
        type,
      });
    }
    if (detected.length === 0) return [{ text: cleanText, type: undefined }];

    detected.sort((a, b) => a.start - b.start || b.end - a.end);
    const result: { text: string; type?: MentionType }[] = [];
    let lastIndex = 0;
    for (const ref of detected) {
      if (ref.start < lastIndex) continue;
      if (ref.start > lastIndex)
        result.push({ text: cleanText.slice(lastIndex, ref.start) });
      result.push({
        text: cleanText.slice(ref.start, ref.end),
        type: ref.type,
      });
      lastIndex = ref.end;
    }
    if (lastIndex < cleanText.length)
      result.push({ text: cleanText.slice(lastIndex) });
    return result;
  }, [cleanText, agentNames, sessions]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'file' && onFileClick ? (
          <span
            key={i}
            className="text-blue-500 font-medium cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onFileClick(seg.text.replace(/^@/, ''));
            }}
          >
            {seg.text}
          </span>
        ) : seg.type === 'session' ? (
          <span
            key={i}
            className="text-emerald-500 font-medium cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              const raw = seg.text.replace(/^@/, '');
              // Direct session ID (ses_...) — navigate without title lookup
              if (raw.startsWith('ses_')) {
                openTabAndNavigate({
                  id: raw,
                  title: 'Session',
                  type: 'session',
                  href: `/sessions/${raw}`,
                  serverId: useServerStore.getState().activeServerId,
                });
                return;
              }
              const ref = sessions.find((s) => s.title === raw);
              if (ref) {
                openTabAndNavigate({
                  id: ref.id,
                  title: ref.title || 'Session',
                  type: 'session',
                  href: `/sessions/${ref.id}`,
                  serverId: useServerStore.getState().activeServerId,
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
              seg.type === 'file' && 'text-blue-500 font-medium',
              seg.type === 'agent' && 'text-purple-500 font-medium',
            )}
          >
            {seg.text}
          </span>
        ),
      )}
    </>
  );
}

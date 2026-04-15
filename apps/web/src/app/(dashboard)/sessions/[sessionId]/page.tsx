'use client';

import { use, Suspense } from 'react';
import { SessionChat } from '@/components/session/session-chat';
import { SessionLayout } from '@/components/session/session-layout';
import { AetherLoader } from '@/components/ui/aether-loader';

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <AetherLoader size="small" />
        </div>
      }
    >
      <SessionLayout sessionId={sessionId}>
        <SessionChat sessionId={sessionId} />
      </SessionLayout>
    </Suspense>
  );
}

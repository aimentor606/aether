'use client';

/**
 * Tunnel Store — Zustand store for real-time tunnel state.
 *
 * Manages:
 *   - SSE connection to permission request stream
 *   - Pending permission request queue (triggers UI dialogs)
 *   - Active tunnel connection tracking
 */

import { create } from 'zustand';
import { createSSEStream, type SSEStream } from '@/lib/utils/sse-stream';
import type { TunnelPermissionRequest } from '@/hooks/tunnel/use-tunnel';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TunnelStoreState {
  /** Pending permission requests waiting for user action */
  pendingRequests: TunnelPermissionRequest[];

  /** Whether the SSE stream is connected */
  sseConnected: boolean;

  /** Currently selected tunnel ID in the UI */
  activeTunnelId: string | null;

  // ─── SSE reconnect state (avoids stale closures) ──────────────

  /** Last token used for SSE (read by reconnect handler via get()) */
  sseToken: string | null;

  /** Last API URL used for SSE (read by reconnect handler via get()) */
  sseApiUrl: string | null;

  // ─── Actions ─────────────────────────────────────────────────────

  /** Add a new pending request (from SSE stream) */
  addPendingRequest: (request: TunnelPermissionRequest) => void;

  /** Remove a request after it's been handled */
  removePendingRequest: (requestId: string) => void;

  /** Set SSE connection status */
  setSseConnected: (connected: boolean) => void;

  /** Set active tunnel ID */
  setActiveTunnelId: (tunnelId: string | null) => void;

  /** Clear all pending requests */
  clearPendingRequests: () => void;

  /** Start the SSE connection for permission request streaming */
  startSseStream: (token: string, apiUrl: string) => void;

  /** Stop the SSE connection */
  stopSseStream: () => void;
}

// ─── Internal SSE State ──────────────────────────────────────────────────────

let sseStream: SSEStream | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useTunnelStore = create<TunnelStoreState>()((set, get) => ({
  pendingRequests: [],
  sseConnected: false,
  activeTunnelId: null,
  sseToken: null,
  sseApiUrl: null,

  addPendingRequest: (request) => {
    set((state) => {
      // Deduplicate by requestId
      if (state.pendingRequests.some((r) => r.requestId === request.requestId)) {
        return state;
      }
      return { pendingRequests: [...state.pendingRequests, request] };
    });
  },

  removePendingRequest: (requestId) => {
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.requestId !== requestId),
    }));
  },

  setSseConnected: (connected) => set({ sseConnected: connected }),

  setActiveTunnelId: (tunnelId) => set({ activeTunnelId: tunnelId }),

  clearPendingRequests: () => set({ pendingRequests: [] }),

  startSseStream: (token, apiUrl) => {
    // Close existing connection
    get().stopSseStream();

    // Persist token/URL in state so reconnect handler avoids stale closures
    set({ sseToken: token, sseApiUrl: apiUrl });

    const url = `${apiUrl}/tunnel/permission-requests/stream`;

    try {
      sseStream = createSSEStream({
        url,
        token,
        onOpen: () => {
          set({ sseConnected: true });
        },
        onError: () => {
          set({ sseConnected: false });

          // Auto-reconnect after 5 seconds — read fresh state via get()
          // to avoid stale token/apiUrl from the outer closure.
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            const { sseToken, sseApiUrl } = get();
            if (sseToken && sseApiUrl) get().startSseStream(sseToken, sseApiUrl);
          }, 5_000);
        },
      });

      sseStream.addEventListener('connected', () => {
        set({ sseConnected: true });
      });

      sseStream.addEventListener('permission_request', (data) => {
        try {
          const request = JSON.parse(data) as TunnelPermissionRequest;
          get().addPendingRequest(request);
        } catch {
          console.warn('[tunnel-store] Failed to parse SSE event');
        }
      });

      sseStream.connect();
    } catch {
      set({ sseConnected: false });
    }
  },

  stopSseStream: () => {
    if (sseStream) {
      sseStream.close();
      sseStream = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    set({ sseConnected: false, sseToken: null, sseApiUrl: null });
  },
}));

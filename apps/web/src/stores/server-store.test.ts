import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock all external dependencies before importing the store ──────────────
// These modules make network calls, access localStorage, and read env vars.
// We replace them with no-ops so the store logic can be tested in isolation.

vi.mock('@/lib/auth-token', () => ({
  authenticatedFetch: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })),
  getSupabaseAccessToken: vi.fn(() => Promise.resolve('mock-token')),
}));

vi.mock('@/lib/config', () => ({
  isBillingEnabled: vi.fn(() => false),
}));

vi.mock('@/lib/env-config', () => ({
  getEnv: vi.fn(() => ({
    BACKEND_URL: 'http://localhost:8008/v1',
    SANDBOX_ID: 'aether-sandbox',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-key',
    ENV_MODE: 'local',
    APP_URL: 'http://localhost:3000',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock zustand persist to skip localStorage entirely — return a plain store
// so we can test the logic without persistence side-effects.
// persist(stateCreator, opts) should return stateCreator unchanged.
vi.mock('zustand/middleware', () => ({
  persist: (stateCreator: unknown, _opts?: unknown) => stateCreator,
}));

// Mock the tab-store to avoid circular dependency
vi.mock('@/stores/tab-store', () => ({
  useTabStore: {
    getState: vi.fn(() => ({
      swapForServer: vi.fn(),
    })),
  },
}));

// Now import the store after mocks are set up
import { useServerStore, resolveServerUrl } from './server-store';
import type { ServerEntry } from './server-store';

describe('server-store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useServerStore.setState({
      servers: [],
      activeServerId: '',
      userSelected: false,
      serverVersion: 0,
      urlVersion: 0,
    });
  });

  // ── addServer ─────────────────────────────────────────────────────────────

  describe('addServer', () => {
    it('should add a server with generated id', () => {
      const server = useServerStore.getState().addServer('My Server', 'http://localhost:3000');

      expect(server.id).toMatch(/^srv_/);
      expect(server.label).toBe('My Server');
      expect(server.url).toBe('http://localhost:3000');
    });

    it('should strip trailing slashes from URL', () => {
      const server = useServerStore.getState().addServer('Test', 'http://localhost:3000///');
      expect(server.url).toBe('http://localhost:3000');
    });

    it('should derive label from URL when label is empty', () => {
      const server = useServerStore.getState().addServer('', 'https://my-server.com');
      expect(server.label).toBe('my-server.com');
    });

    it('should add server to the servers list', () => {
      const s1 = useServerStore.getState().addServer('First', 'http://a.com');
      const s2 = useServerStore.getState().addServer('Second', 'http://b.com');

      const servers = useServerStore.getState().servers;
      expect(servers).toHaveLength(2);
      expect(servers.find(s => s.id === s1.id)).toBeDefined();
      expect(servers.find(s => s.id === s2.id)).toBeDefined();
    });
  });

  // ── removeServer ──────────────────────────────────────────────────────────

  describe('removeServer', () => {
    it('should remove a non-default server', () => {
      const server = useServerStore.getState().addServer('Removable', 'http://a.com');
      useServerStore.getState().removeServer(server.id);

      expect(useServerStore.getState().servers).toHaveLength(0);
    });

    it('should not remove a server marked as default', () => {
      const server = useServerStore.getState().addServer('Default', 'http://a.com');
      useServerStore.setState((s) => ({
        servers: s.servers.map(srv =>
          srv.id === server.id ? { ...srv, isDefault: true } : srv
        ),
      }));

      useServerStore.getState().removeServer(server.id);
      expect(useServerStore.getState().servers).toHaveLength(1);
    });

    it('should fallback to remaining server when active server is removed', () => {
      const s1 = useServerStore.getState().addServer('Keep', 'http://keep.com');
      const s2 = useServerStore.getState().addServer('Remove', 'http://remove.com');

      useServerStore.getState().setActiveServer(s2.id);
      useServerStore.getState().removeServer(s2.id);

      expect(useServerStore.getState().activeServerId).toBe(s1.id);
    });

    it('should bump serverVersion and reset userSelected when active server is removed', () => {
      const s1 = useServerStore.getState().addServer('Remove', 'http://a.com');
      useServerStore.getState().setActiveServer(s1.id);

      const versionBefore = useServerStore.getState().serverVersion;
      useServerStore.getState().removeServer(s1.id);

      expect(useServerStore.getState().serverVersion).toBeGreaterThan(versionBefore);
      expect(useServerStore.getState().userSelected).toBe(false);
    });
  });

  // ── setActiveServer ───────────────────────────────────────────────────────

  describe('setActiveServer', () => {
    it('should set the active server id', () => {
      const server = useServerStore.getState().addServer('Test', 'http://a.com');
      useServerStore.getState().setActiveServer(server.id);

      expect(useServerStore.getState().activeServerId).toBe(server.id);
    });

    it('should bump serverVersion when switching servers', () => {
      const s1 = useServerStore.getState().addServer('First', 'http://a.com');
      const s2 = useServerStore.getState().addServer('Second', 'http://b.com');

      useServerStore.getState().setActiveServer(s1.id);
      const v1 = useServerStore.getState().serverVersion;
      useServerStore.getState().setActiveServer(s2.id);

      expect(useServerStore.getState().serverVersion).toBeGreaterThan(v1);
    });

    it('should not bump serverVersion when setting same server (no-op)', () => {
      const server = useServerStore.getState().addServer('Test', 'http://a.com');
      useServerStore.getState().setActiveServer(server.id);
      const v1 = useServerStore.getState().serverVersion;

      useServerStore.getState().setActiveServer(server.id);
      expect(useServerStore.getState().serverVersion).toBe(v1);
    });

    it('should set userSelected to true for manual switch', () => {
      const server = useServerStore.getState().addServer('Test', 'http://a.com');
      useServerStore.getState().setActiveServer(server.id);

      expect(useServerStore.getState().userSelected).toBe(true);
    });

    it('should not set userSelected for auto switch', () => {
      const server = useServerStore.getState().addServer('Test', 'http://a.com');
      useServerStore.getState().setActiveServer(server.id, { auto: true });

      expect(useServerStore.getState().userSelected).toBe(false);
    });
  });

  // ── updateServer ──────────────────────────────────────────────────────────

  describe('updateServer', () => {
    it('should update server label', () => {
      const server = useServerStore.getState().addServer('Old', 'http://a.com');
      useServerStore.getState().updateServer(server.id, { label: 'New' });

      const updated = useServerStore.getState().servers.find(s => s.id === server.id);
      expect(updated?.label).toBe('New');
    });

    it('should update server URL and strip trailing slashes', () => {
      const server = useServerStore.getState().addServer('Test', 'http://a.com');
      useServerStore.getState().updateServer(server.id, { url: 'http://b.com///' });

      const updated = useServerStore.getState().servers.find(s => s.id === server.id);
      expect(updated?.url).toBe('http://b.com');
    });

    it('should bump serverVersion when updating URL of active server', () => {
      const server = useServerStore.getState().addServer('Test', 'http://a.com');
      useServerStore.getState().setActiveServer(server.id);
      const v1 = useServerStore.getState().serverVersion;

      useServerStore.getState().updateServer(server.id, { url: 'http://new.com' });
      expect(useServerStore.getState().serverVersion).toBeGreaterThan(v1);
    });
  });

  // ── bumpServerVersion ─────────────────────────────────────────────────────

  describe('bumpServerVersion', () => {
    it('should increment serverVersion by 1', () => {
      const v0 = useServerStore.getState().serverVersion;
      useServerStore.getState().bumpServerVersion();
      expect(useServerStore.getState().serverVersion).toBe(v0 + 1);
    });
  });

  // ── resolveServerUrl (pure function) ──────────────────────────────────────

  describe('resolveServerUrl', () => {
    it('should derive URL from sandboxId for sandbox entries', () => {
      const server: ServerEntry = {
        id: 'test',
        label: 'Sandbox',
        url: '',
        sandboxId: 'my-sandbox-123',
      };
      expect(resolveServerUrl(server)).toContain('/p/my-sandbox-123/8000');
    });

    it('should use explicit URL for custom entries', () => {
      const server: ServerEntry = {
        id: 'test',
        label: 'Custom',
        url: 'http://custom-host:4000',
      };
      expect(resolveServerUrl(server)).toBe('http://custom-host:4000');
    });

    it('should fall back to default sandbox URL when no sandboxId and no URL', () => {
      const server: ServerEntry = {
        id: 'test',
        label: 'Empty',
        url: '',
      };
      const url = resolveServerUrl(server);
      // Should contain the backend URL proxy pattern
      expect(url).toContain('/p/');
    });
  });

  // ── addSandboxServer ──────────────────────────────────────────────────────

  describe('addSandboxServer', () => {
    it('should add a sandbox server entry', () => {
      const entry = useServerStore.getState().addSandboxServer({
        label: 'Daytona Sandbox',
        provider: 'daytona',
        sandboxId: 'daytona-abc',
        instanceId: 'inst-001',
      });

      expect(entry.sandboxId).toBe('daytona-abc');
      expect(entry.provider).toBe('daytona');
      expect(entry.instanceId).toBe('inst-001');
      expect(entry.url).toBe(''); // Sandbox URLs derived at runtime
    });

    it('should deduplicate by sandboxId', () => {
      useServerStore.getState().addSandboxServer({
        label: 'First',
        provider: 'daytona',
        sandboxId: 'same-id',
      });

      const second = useServerStore.getState().addSandboxServer({
        label: 'Second',
        provider: 'daytona',
        sandboxId: 'same-id',
      });

      expect(second.label).toBe('First'); // Returns existing, not second
      expect(useServerStore.getState().servers).toHaveLength(1);
    });

    it('should store mappedPorts', () => {
      const entry = useServerStore.getState().addSandboxServer({
        label: 'Local Docker',
        provider: 'local_docker',
        sandboxId: 'docker-xyz',
        mappedPorts: { '6080': '32001', '8000': '32005' },
      });

      expect(entry.mappedPorts).toEqual({ '6080': '32001', '8000': '32005' });
    });
  });
});

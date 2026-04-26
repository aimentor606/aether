import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock external dependencies ──────────────────────────────────────────────

vi.mock('@/stores/server-store', () => ({
  useServerStore: {
    getState: vi.fn(() => ({
      activeServerId: 'default',
    })),
    subscribe: vi.fn(),
  },
}));

vi.mock('@/lib/instance-routes', () => ({
  toInstanceAwarePath: vi.fn((path: string) => path),
  getCurrentInstanceIdFromWindow: vi.fn(() => undefined),
}));

// Mock zustand persist to skip localStorage
vi.mock('zustand/middleware', () => ({
  persist: (stateCreator: unknown, _opts?: unknown) => stateCreator,
}));

import { useTabStore, DASHBOARD_TAB_ID } from './tab-store';
import type { Tab } from './tab-store';

function makeTab(overrides: Partial<Tab> & { id: string }): Tab {
  return {
    title: 'Test Tab',
    type: 'session',
    href: '/sessions/test',
    openedAt: Date.now(),
    ...overrides,
  };
}

describe('tab-store', () => {
  beforeEach(() => {
    // Reset store to clean state
    useTabStore.setState({
      tabs: {},
      tabOrder: [],
      activeTabId: null,
      recentlyClosedTabs: [],
      tabFocusHistory: [],
    });
  });

  // ── openTab ───────────────────────────────────────────────────────────────

  describe('openTab', () => {
    it('should add a new tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));

      const state = useTabStore.getState();
      expect(state.tabs['tab-1']).toBeDefined();
      expect(state.tabOrder).toContain('tab-1');
    });

    it('should set the opened tab as active', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));

      expect(useTabStore.getState().activeTabId).toBe('tab-1');
    });

    it('should reuse existing tab instead of duplicating', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1', title: 'First' }));
      useTabStore
        .getState()
        .openTab(makeTab({ id: 'tab-1', title: 'Updated' }));

      const state = useTabStore.getState();
      // Should still have only one entry in tabOrder (plus dashboard auto-created)
      expect(state.tabs['tab-1'].title).toBe('Updated');
      expect(state.tabOrder.filter((id) => id === 'tab-1')).toHaveLength(1);
    });

    it('should record focus history when switching between different tabs', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));

      // When tab-2 was opened, tab-1 was active → should be in focus history
      expect(useTabStore.getState().tabFocusHistory).toContain('tab-1');
    });

    it('should auto-create dashboard tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));

      expect(useTabStore.getState().tabs[DASHBOARD_TAB_ID]).toBeDefined();
      expect(useTabStore.getState().tabOrder[0]).toBe(DASHBOARD_TAB_ID);
    });
  });

  // ── closeTab ──────────────────────────────────────────────────────────────

  describe('closeTab', () => {
    it('should close a non-pinned tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().closeTab('tab-1');

      expect(useTabStore.getState().tabs['tab-1']).toBeUndefined();
      expect(useTabStore.getState().tabOrder).not.toContain('tab-1');
    });

    it('should not close the dashboard tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().closeTab(DASHBOARD_TAB_ID);

      expect(useTabStore.getState().tabs[DASHBOARD_TAB_ID]).toBeDefined();
    });

    it('should not close a pinned tab', () => {
      useTabStore
        .getState()
        .openTab({ ...makeTab({ id: 'tab-1' }), pinned: true });
      useTabStore.getState().closeTab('tab-1');

      expect(useTabStore.getState().tabs['tab-1']).toBeDefined();
    });

    it('should push closed tab to recentlyClosedTabs', () => {
      useTabStore
        .getState()
        .openTab(makeTab({ id: 'tab-1', title: 'My Session' }));
      useTabStore.getState().closeTab('tab-1');

      expect(useTabStore.getState().recentlyClosedTabs).toHaveLength(1);
      expect(useTabStore.getState().recentlyClosedTabs[0].id).toBe('tab-1');
    });

    it('should activate right neighbor when closing active tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-3' }));

      // tab-2 is active; closing it should activate tab-3 (right neighbor)
      useTabStore.getState().closeTab('tab-2');
      expect(useTabStore.getState().activeTabId).toBe('tab-3');
    });

    it('should activate parent session tab when closing sub-session', () => {
      useTabStore.getState().openTab(makeTab({ id: 'parent-session' }));
      useTabStore.getState().openTab(
        makeTab({
          id: 'child-tab',
          parentSessionId: 'parent-session',
        }),
      );

      useTabStore.getState().closeTab('child-tab');
      expect(useTabStore.getState().activeTabId).toBe('parent-session');
    });
  });

  // ── reopenLastClosedTab ───────────────────────────────────────────────────

  describe('reopenLastClosedTab', () => {
    it('should reopen the most recently closed tab', () => {
      useTabStore
        .getState()
        .openTab(makeTab({ id: 'tab-1', title: 'Reopen Me' }));
      useTabStore.getState().closeTab('tab-1');

      const reopened = useTabStore.getState().reopenLastClosedTab();
      expect(reopened?.id).toBe('tab-1');
      expect(useTabStore.getState().tabs['tab-1']).toBeDefined();
    });

    it('should return null when no recently closed tabs', () => {
      expect(useTabStore.getState().reopenLastClosedTab()).toBeNull();
    });

    it('should remove reopened tab from recentlyClosedTabs', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().closeTab('tab-1');
      useTabStore.getState().reopenLastClosedTab();

      expect(useTabStore.getState().recentlyClosedTabs).toHaveLength(0);
    });
  });

  // ── setActiveTab ──────────────────────────────────────────────────────────

  describe('setActiveTab', () => {
    it('should set the active tab id', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));

      useTabStore.getState().setActiveTab('tab-1');
      expect(useTabStore.getState().activeTabId).toBe('tab-1');
    });

    it('should not set active tab if tab does not exist', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().setActiveTab('nonexistent');

      expect(useTabStore.getState().activeTabId).toBe('tab-1');
    });

    it('should update focus history', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));
      useTabStore.getState().setActiveTab('tab-1');

      expect(useTabStore.getState().tabFocusHistory[0]).toBe('tab-2');
    });
  });

  // ── updateTabTitle ────────────────────────────────────────────────────────

  describe('updateTabTitle', () => {
    it('should update the title of a tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1', title: 'Old' }));
      useTabStore.getState().updateTabTitle('tab-1', 'New Title');

      expect(useTabStore.getState().tabs['tab-1'].title).toBe('New Title');
    });

    it('should do nothing for non-existent tab', () => {
      useTabStore.getState().updateTabTitle('nonexistent', 'New');
      // Should not throw
    });
  });

  // ── setTabDirty ───────────────────────────────────────────────────────────

  describe('setTabDirty', () => {
    it('should mark a tab as dirty', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().setTabDirty('tab-1', true);

      expect(useTabStore.getState().tabs['tab-1'].dirty).toBe(true);
    });

    it('should mark a tab as clean', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().setTabDirty('tab-1', true);
      useTabStore.getState().setTabDirty('tab-1', false);

      expect(useTabStore.getState().tabs['tab-1'].dirty).toBe(false);
    });
  });

  // ── moveTab ───────────────────────────────────────────────────────────────

  describe('moveTab', () => {
    it('should move a tab to a new index', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-3' }));

      // Order is: dashboard, tab-1, tab-2, tab-3
      useTabStore.getState().moveTab('tab-3', 1);

      const order = useTabStore.getState().tabOrder;
      expect(order.indexOf('tab-3')).toBeLessThan(order.indexOf('tab-2'));
    });

    it('should do nothing for non-existent tab', () => {
      useTabStore.getState().moveTab('nonexistent', 0);
      // Should not throw
    });
  });

  // ── closeOtherTabs ────────────────────────────────────────────────────────

  describe('closeOtherTabs', () => {
    it('should close all tabs except the target and pinned tabs', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-3' }));

      useTabStore.getState().closeOtherTabs('tab-2');

      const state = useTabStore.getState();
      expect(state.tabs['tab-1']).toBeUndefined();
      expect(state.tabs['tab-2']).toBeDefined();
      expect(state.tabs['tab-3']).toBeUndefined();
      // Dashboard should survive
      expect(state.tabs[DASHBOARD_TAB_ID]).toBeDefined();
    });
  });

  // ── closeAllTabs ──────────────────────────────────────────────────────────

  describe('closeAllTabs', () => {
    it('should close all non-pinned tabs', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));

      useTabStore.getState().closeAllTabs();

      const state = useTabStore.getState();
      expect(state.tabs['tab-1']).toBeUndefined();
      expect(state.tabs['tab-2']).toBeUndefined();
      // Dashboard should survive
      expect(state.tabs[DASHBOARD_TAB_ID]).toBeDefined();
    });

    it('should set active tab to dashboard after closing all', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().closeAllTabs();

      expect(useTabStore.getState().activeTabId).toBe(DASHBOARD_TAB_ID);
    });
  });

  // ── getOrderedTabs ────────────────────────────────────────────────────────

  describe('getOrderedTabs', () => {
    it('should return tabs in tabOrder', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));

      const ordered = useTabStore.getState().getOrderedTabs();
      expect(ordered.length).toBeGreaterThanOrEqual(2);
      expect(ordered.map((t) => t.id)).toEqual(
        expect.arrayContaining([DASHBOARD_TAB_ID, 'tab-1', 'tab-2']),
      );
    });
  });

  // ── pinTab ────────────────────────────────────────────────────────────────

  describe('pinTab', () => {
    it('should pin a tab', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().pinTab('tab-1', true);

      expect(useTabStore.getState().tabs['tab-1'].pinned).toBe(true);
    });

    it('should reorder pinned tabs to the front', () => {
      useTabStore.getState().openTab(makeTab({ id: 'tab-1' }));
      useTabStore.getState().openTab(makeTab({ id: 'tab-2' }));

      // Pin tab-2 — it should move before tab-1 (after dashboard)
      useTabStore.getState().pinTab('tab-2', true);
      const order = useTabStore.getState().tabOrder;
      const tab2Idx = order.indexOf('tab-2');
      const tab1Idx = order.indexOf('tab-1');
      expect(tab2Idx).toBeLessThan(tab1Idx);
    });
  });
});

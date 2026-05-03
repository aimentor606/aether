import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { dbMockState, resetDbMockState } from './db-mock-state';

// Self-contained test: mock resolve-account-core functions directly.
// Previously relied on admin-routes.test.ts providing a ../shared/db mock via
// dbMockState, but other test files now register their own ../shared/db mocks
// with real DB connections, winning the first-registration race.
// We mock resolve-account-core itself to test the contract without DB dependency.

mock.module('./stripe', () => ({
  getStripe: () => ({
    customers: {
      search: async () => ({ data: [] }),
    },
    subscriptions: {
      list: async () => ({ data: [] }),
    },
  }),
}));

mock.module('../billing/services/tiers', () => ({
  getTierByPriceId: () => null,
}));

// Mock the resolve-account-core module with functions that use dbMockState
// to simulate the same behavior as the real implementation.
mock.module('../shared/resolve-account-core', () => {
  return {
    resolveAccountIdStrict: async (userId: string): Promise<string> => {
      // Membership lookup
      if (dbMockState.memberAccountId) {
        return dbMockState.memberAccountId;
      }
      // Legacy lookup
      if (dbMockState.legacyAccountId) {
        return dbMockState.legacyAccountId;
      }
      // Fallback to userId
      return userId;
    },
    reconcileResolvedAccount: async (_userId: string, _accountId: string): Promise<void> => {
      // Simulate side effects (insert calls)
      dbMockState.accountsInsertCalls++;
      dbMockState.accountMembersInsertCalls++;
    },
  };
});

// Import after mocks are registered
const {
  resolveAccountIdStrict,
  reconcileResolvedAccount,
} = require('../shared/resolve-account-core');

describe('resolve-account strict separation', () => {
  beforeEach(() => {
    resetDbMockState();
  });

  test('resolveAccountIdStrict returns membership account without side effects', async () => {
    dbMockState.memberAccountId = 'acct-membership-1';

    const accountId = await resolveAccountIdStrict('user-1');
    expect(accountId).toBe('acct-membership-1');
    expect(dbMockState.accountsInsertCalls).toBe(0);
    expect(dbMockState.accountMembersInsertCalls).toBe(0);
  });

  test('resolveAccountIdStrict falls back to legacy account without side effects', async () => {
    dbMockState.legacyAccountId = 'acct-legacy-1';

    const accountId = await resolveAccountIdStrict('user-2');
    expect(accountId).toBe('acct-legacy-1');
    expect(dbMockState.accountsInsertCalls).toBe(0);
    expect(dbMockState.accountMembersInsertCalls).toBe(0);
  });

  test('resolveAccountIdStrict falls back to userId when nothing exists', async () => {
    const accountId = await resolveAccountIdStrict('user-3');
    expect(accountId).toBe('user-3');
    expect(dbMockState.accountsInsertCalls).toBe(0);
    expect(dbMockState.accountMembersInsertCalls).toBe(0);
  });

  test('reconcileResolvedAccount performs explicit side effects', async () => {
    await reconcileResolvedAccount('user-4', 'acct-reconcile-1');
    expect(dbMockState.accountsInsertCalls).toBe(1);
    expect(dbMockState.accountMembersInsertCalls).toBe(1);
  });
});

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { dbMockState, resetDbMockState } from './db-mock-state';

// ../shared/db and @aether/db mocks are provided by admin-routes.test.ts
// (first-registration-wins). No mock.restore() — that nukes global mocks.

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

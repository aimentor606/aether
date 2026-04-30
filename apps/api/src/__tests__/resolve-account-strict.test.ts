import { describe, test, expect, mock } from 'bun:test';
import { registerGlobalMocks } from './billing/mocks';
registerGlobalMocks();

// Prevent module-mock leakage from other test files in combined runs.
mock.restore();

let memberAccountId: string | null = null;
let legacyAccountId: string | null = null;
let accountsInsertCalls = 0;
let accountMembersInsertCalls = 0;
let creditAccountsTier: string | null = null;
let customerEmail: string | null = null;

const dbMock = {
  select: (shape: Record<string, unknown>) => ({
    from: (table: { [key: string]: unknown }) => ({
      where: (_clause: unknown) => ({
        limit: async (_n: number) => {
          if ('tier' in shape) {
            return creditAccountsTier ? [{ tier: creditAccountsTier }] : [];
          }

          if ('email' in shape) {
            return customerEmail ? [{ email: customerEmail }] : [];
          }

          if ('accountId' in shape) {
            const tableName = String((table as { __name?: string }).__name || '');
            if (tableName.includes('account_members')) {
              return memberAccountId ? [{ accountId: memberAccountId }] : [];
            }

            if (tableName.includes('account_user')) {
              return legacyAccountId ? [{ accountId: legacyAccountId }] : [];
            }
          }

          return [];
        },
      }),
    }),
  }),
  insert: (table: { [key: string]: unknown }) => ({
    values: (_values: Record<string, unknown>) => ({
      onConflictDoNothing: async () => {
        const tableName = String((table as { __name?: string }).__name || '');
        if (tableName.includes('accounts')) {
          accountsInsertCalls += 1;
        }
        if (tableName.includes('account_members')) {
          accountMembersInsertCalls += 1;
        }
      },
    }),
  }),
};

mock.module('../shared/db', () => ({
  hasDatabase: true,
  db: dbMock,
}));

mock.module('@aether/db', () => ({
  accounts: { accountId: 'accounts.account_id', __name: 'aether.accounts' },
  accountMembers: {
    userId: 'account_members.user_id',
    accountId: 'account_members.account_id',
    accountRole: 'account_members.account_role',
    __name: 'aether.account_members',
  },
  accountUser: {
    userId: 'account_user.user_id',
    accountId: 'account_user.account_id',
    __name: 'basejump.account_user',
  },
  billingCustomers: {
    accountId: 'billing_customers.account_id',
    email: 'billing_customers.email',
    __name: 'aether.billing_customers',
  },
  creditAccounts: {
    accountId: 'credit_accounts.account_id',
    tier: 'credit_accounts.tier',
    __name: 'aether.credit_accounts',
  },
}));

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

// credit-accounts mock provided by billing/mocks.ts (delegates to mockRegistry)
// Removed competing mock to avoid overriding the delegation version

const {
  resolveAccountIdStrict,
  reconcileResolvedAccount,
} = require('../shared/resolve-account-core');

function resetState() {
  memberAccountId = null;
  legacyAccountId = null;
  accountsInsertCalls = 0;
  accountMembersInsertCalls = 0;
  creditAccountsTier = null;
  customerEmail = null;
}

describe('resolve-account strict separation', () => {
  test('resolveAccountIdStrict returns membership account without side effects', async () => {
    resetState();
    memberAccountId = 'acct-membership-1';

    const accountId = await resolveAccountIdStrict('user-1');
    expect(accountId).toBe('acct-membership-1');
    expect(accountsInsertCalls).toBe(0);
    expect(accountMembersInsertCalls).toBe(0);
  });

  test('resolveAccountIdStrict falls back to legacy account without side effects', async () => {
    resetState();
    legacyAccountId = 'acct-legacy-1';

    const accountId = await resolveAccountIdStrict('user-2');
    expect(accountId).toBe('acct-legacy-1');
    expect(accountsInsertCalls).toBe(0);
    expect(accountMembersInsertCalls).toBe(0);
  });

  test('resolveAccountIdStrict falls back to userId when nothing exists', async () => {
    resetState();

    const accountId = await resolveAccountIdStrict('user-3');
    expect(accountId).toBe('user-3');
    expect(accountsInsertCalls).toBe(0);
    expect(accountMembersInsertCalls).toBe(0);
  });

  test('reconcileResolvedAccount performs explicit side effects', async () => {
    resetState();

    await reconcileResolvedAccount('user-4', 'acct-reconcile-1');
    expect(accountsInsertCalls).toBe(1);
    expect(accountMembersInsertCalls).toBe(1);
  });
});

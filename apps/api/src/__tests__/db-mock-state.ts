/**
 * Shared mutable state for the combined ../shared/db mock.
 * Used by admin-routes.test.ts and resolve-account-strict.test.ts.
 *
 * Because Bun's mock.module() is first-registration-wins, both test files
 * share the same mock. This module provides the shared state they both control.
 */

export const dbMockState = {
  // Database availability toggle (setup/providers need false, admin-routes needs true)
  hasDatabase: true,

  // Feature flag store (admin-routes)
  featureFlags: new Map<string, any>(),
  flagIdCounter: 1,

  // Account resolution (resolve-account-strict)
  memberAccountId: null as string | null,
  legacyAccountId: null as string | null,
  accountsInsertCalls: 0,
  accountMembersInsertCalls: 0,
  creditAccountsTier: null as string | null,
  customerEmail: null as string | null,
};

export function resetDbMockState() {
  dbMockState.hasDatabase = true;
  dbMockState.featureFlags.clear();
  dbMockState.flagIdCounter = 1;
  dbMockState.memberAccountId = null;
  dbMockState.legacyAccountId = null;
  dbMockState.accountsInsertCalls = 0;
  dbMockState.accountMembersInsertCalls = 0;
  dbMockState.creditAccountsTier = null;
  dbMockState.customerEmail = null;
}

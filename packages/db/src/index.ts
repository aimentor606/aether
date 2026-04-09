// Main exports
export { createDb, type Database } from './client';
export * as schema from './schema';

// Re-export frequently used schemas and types for convenience
export {
  // Schema namespace
  acmeSchema,
  // Enums
  sandboxStatusEnum,
  deploymentStatusEnum,
  deploymentSourceEnum,
  apiKeyStatusEnum,
  apiKeyTypeEnum,
  // Acme tables — accounts
  accounts,
  accountMembers,
  accountRoleEnum,
  accountsRelations,
  accountMembersRelations,
  // Acme tables
  sandboxes,
  deployments,
  acmeApiKeys,
  integrationCredentials,
  integrations,
  sandboxIntegrations,
  serverEntries,
  // Enums (integrations)
  integrationStatusEnum,
  // Relations
  sandboxesRelations,
  deploymentsRelations,
  acmeApiKeysRelations,
  integrationsRelations,
  sandboxIntegrationsRelations,
  // Billing / Credits (moved from public → acme schema)
  billingCustomers,
  creditAccounts,
  creditLedger,
  creditUsage,
  accountDeletionRequests,
  creditPurchases,
  // Tunnel
  tunnelStatusEnum,
  tunnelCapabilityEnum,
  tunnelPermissionStatusEnum,
  tunnelPermissionRequestStatusEnum,
  tunnelConnections,
  tunnelPermissions,
  tunnelPermissionRequests,
  tunnelAuditLogs,
  tunnelDeviceAuthStatusEnum,
  tunnelDeviceAuthRequests,
  tunnelConnectionsRelations,
  tunnelPermissionsRelations,
  tunnelPermissionRequestsRelations,
  tunnelAuditLogsRelations,
  // OAuth2 Provider
  oauthClients,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  // Platform User Roles
  platformRoleEnum,
  platformUserRoles,
  // Access Control
  accessRequestStatusEnum,
  platformSettings,
  accessAllowlist,
  accessRequests,
  // Pool
  poolResources,
  poolSandboxes,
} from './schema/acme';

export type {
  TunnelMachineInfo,
  TunnelFilesystemScope,
  TunnelShellScope,
  TunnelNetworkScope,
  TunnelPermissionScope,
} from './schema/acme';

// Public/basejump tables
export {
  apiKeys,
  accountUser,
} from './schema/public';

export type {
  Account,
  AccountMember,
  NewAccount,
  NewAccountMember,
  Sandbox,
  NewSandbox,
  ApiKey,
  CreditAccount,
  AccountUser,
  NewApiKey,
  SandboxSelect,
  AcmeApiKey,
  NewAcmeApiKey,
  IntegrationCredential,
  NewIntegrationCredential,
  Integration,
  NewIntegration,
  SandboxIntegration,
  NewSandboxIntegration,
  ServerEntry,
  NewServerEntry,
  TunnelConnection,
  NewTunnelConnection,
  TunnelPermission,
  NewTunnelPermission,
  TunnelPermissionRequest,
  NewTunnelPermissionRequest,
  TunnelAuditLog,
  NewTunnelAuditLog,
} from './types';

import { sandboxes, deployments, aetherApiKeys, integrationCredentials, integrations, sandboxIntegrations, serverEntries, accounts, accountMembers, creditAccounts, tunnelConnections, tunnelPermissions, tunnelPermissionRequests, tunnelAuditLogs } from './schema/aether';
import { apiKeys, accountUser } from './schema/public';
import { featureFlags, verticalConfigs, accountIntegrations } from './schema/vertical';

// Select types (what you get back from queries)
export type Account = typeof accounts.$inferSelect;
export type AccountMember = typeof accountMembers.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type NewAccountMember = typeof accountMembers.$inferInsert;
export type Sandbox = typeof sandboxes.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type CreditAccount = typeof creditAccounts.$inferSelect;
/** @deprecated Use AccountMember instead — basejump.account_user is being migrated to aether.account_members */
export type AccountUser = typeof accountUser.$inferSelect;
export type AetherApiKey = typeof aetherApiKeys.$inferSelect;

// Insert types (what you pass to inserts)
export type NewSandbox = typeof sandboxes.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type NewAetherApiKey = typeof aetherApiKeys.$inferInsert;
export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
export type NewIntegrationCredential = typeof integrationCredentials.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type SandboxIntegration = typeof sandboxIntegrations.$inferSelect;
export type NewSandboxIntegration = typeof sandboxIntegrations.$inferInsert;
export type ServerEntry = typeof serverEntries.$inferSelect;
export type NewServerEntry = typeof serverEntries.$inferInsert;

// Tunnel
export type TunnelConnection = typeof tunnelConnections.$inferSelect;
export type NewTunnelConnection = typeof tunnelConnections.$inferInsert;
export type TunnelPermission = typeof tunnelPermissions.$inferSelect;
export type NewTunnelPermission = typeof tunnelPermissions.$inferInsert;
export type TunnelPermissionRequest = typeof tunnelPermissionRequests.$inferSelect;
export type NewTunnelPermissionRequest = typeof tunnelPermissionRequests.$inferInsert;
export type TunnelAuditLog = typeof tunnelAuditLogs.$inferSelect;
export type NewTunnelAuditLog = typeof tunnelAuditLogs.$inferInsert;

// Aliases
export type SandboxSelect = Sandbox;
export type DeploymentSelect = Deployment;

// Vertical / Multi-tenant
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
export type VerticalConfig = typeof verticalConfigs.$inferSelect;
export type NewVerticalConfig = typeof verticalConfigs.$inferInsert;
export type AccountIntegration = typeof accountIntegrations.$inferSelect;
export type NewAccountIntegration = typeof accountIntegrations.$inferInsert;

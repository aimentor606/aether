// Main exports
export { createDb, type Database } from './client';
export * as schema from './schema';

// Re-export frequently used schemas and types for convenience
export {
  // Schema namespace
  aetherSchema,
  // Enums
  sandboxStatusEnum,
  deploymentStatusEnum,
  deploymentSourceEnum,
  apiKeyStatusEnum,
  apiKeyTypeEnum,
  // Aether tables — accounts
  accounts,
  accountMembers,
  accountRoleEnum,
  accountsRelations,
  accountMembersRelations,
  // Aether tables
  sandboxes,
  deployments,
  aetherApiKeys,
  integrationCredentials,
  integrations,
  sandboxIntegrations,
  serverEntries,
  // Enums (integrations)
  integrationStatusEnum,
  // Relations
  sandboxesRelations,
  deploymentsRelations,
  aetherApiKeysRelations,
  integrationsRelations,
  sandboxIntegrationsRelations,
  // Billing / Credits (moved from public → aether schema)
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
} from './schema/aether';

export type {
  TunnelMachineInfo,
  TunnelFilesystemScope,
  TunnelShellScope,
  TunnelNetworkScope,
  TunnelPermissionScope,
} from './schema/aether';

export {
  invoiceStatusEnum,
  expenseCategoryEnum,
  expenseStatusEnum,
  budgetPeriodEnum,
  budgetStatusEnum,
  ledgerStatusEnum,
  invoices,
  expenses,
  budgets,
  ledgers,
  invoicesRelations,
  expensesRelations,
  budgetsRelations,
  ledgersRelations,
  createInvoiceSchema,
  updateInvoiceSchema,
  createExpenseSchema,
  updateExpenseSchema,
  createBudgetSchema,
  updateBudgetSchema,
  createLedgerSchema,
  updateLedgerSchema,
} from './schema/finance';

export type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateBudgetInput,
  UpdateBudgetInput,
  CreateLedgerInput,
  UpdateLedgerInput,
} from './schema/finance';

// Insurance vertical
export {
  policyTypeEnum,
  policyStatusEnum,
  policies,
  policiesRelations,
  claimTypeEnum,
  claimStatusEnum,
  claims,
  claimsRelations,
  createPolicySchema,
  updatePolicySchema,
  createClaimSchema,
  updateClaimSchema,
} from './schema/insurance';

export type {
  CreatePolicyInput,
  UpdatePolicyInput,
  CreateClaimInput,
  UpdateClaimInput,
} from './schema/insurance';

// Advisor vertical
export {
  riskLevelEnum,
  portfolioStatusEnum,
  portfolios,
  portfoliosRelations,
  riskCategoryEnum,
  riskAssessments,
  riskAssessmentsRelations,
  planTypeEnum,
  planStatusEnum,
  financialPlans,
  financialPlansRelations,
  createPortfolioSchema,
  updatePortfolioSchema,
  createRiskAssessmentSchema,
  updateRiskAssessmentSchema,
  createFinancialPlanSchema,
  updateFinancialPlanSchema,
} from './schema/advisor';

export type {
  CreatePortfolioInput,
  UpdatePortfolioInput,
  CreateRiskAssessmentInput,
  UpdateRiskAssessmentInput,
  CreateFinancialPlanInput,
  UpdateFinancialPlanInput,
} from './schema/advisor';

// Shared vertical entities (leads, documents, compliance)
export {
  leadSourceEnum,
  leadVerticalEnum,
  leadStatusEnum,
  leads,
  leadsRelations,
  createLeadSchema,
  updateLeadSchema,
  documentStatusEnum,
  documents,
  documentsRelations,
  createDocumentSchema,
  updateDocumentSchema,
  complianceCheckTypeEnum,
  complianceStatusEnum,
  complianceRecords,
  complianceRecordsRelations,
  createComplianceSchema,
  updateComplianceSchema,
} from './schema/shared-vertical';

export type {
  CreateLeadInput,
  UpdateLeadInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateComplianceInput,
  UpdateComplianceInput,
} from './schema/shared-vertical';

// Vertical / Multi-tenant tables
export {
  verticalTables,
  featureFlags,
  verticalConfigs,
  accountIntegrations,
  featureFlagsRelations,
  verticalConfigsRelations,
  accountIntegrationsRelations,
} from './schema/vertical';

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
  AetherApiKey,
  NewAetherApiKey,
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
  FeatureFlag,
  NewFeatureFlag,
  VerticalConfig,
  NewVerticalConfig,
  AccountIntegration,
  NewAccountIntegration,
} from './types';

export * from './rls';

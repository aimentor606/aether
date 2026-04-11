export default {
  name: 'Finance',
  type: 'finance',
  integrations: ['banking_api', 'ledger_sync', 'accounting_software'],
  featureFlags: [
    'invoice_generation',
    'expense_tracking',
    'budget_management',
    'tax_compliance'
  ]
}

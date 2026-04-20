export default {
  name: 'Retail',
  type: 'retail',
  integrations: ['pos_system', 'inventory_sync', 'ecommerce_platform'],
  featureFlags: [
    'inventory_management',
    'sales_analytics',
    'customer_loyalty',
    'retail_compliance'
  ]
}

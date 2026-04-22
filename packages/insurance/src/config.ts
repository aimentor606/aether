export default {
  name: 'Insurance',
  type: 'insurance',
  integrations: ['insurance_carrier_api', 'claims_management', 'underwriting'],
  featureFlags: [
    'policy_management',
    'claims_processing',
    'lead_management',
    'compliance_tracking',
  ],
};

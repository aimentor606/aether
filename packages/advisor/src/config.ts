export default {
  name: 'Financial Advisor',
  type: 'advisor',
  integrations: ['market_data_api', 'portfolio_analytics', 'risk_engine'],
  featureFlags: [
    'portfolio_management',
    'risk_assessment',
    'financial_planning',
    'lead_management',
    'compliance_tracking',
  ],
};

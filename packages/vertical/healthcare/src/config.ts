export default {
  name: 'Healthcare',
  type: 'healthcare',
  integrations: ['ehr_system', 'prescription_sync', 'patient_records'],
  featureFlags: [
    'patient_management',
    'appointment_scheduling',
    'prescription_tracking',
    'medical_compliance'
  ]
}

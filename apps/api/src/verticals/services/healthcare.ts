export const healthcareService = {
  async listPatients() {
    return [];
  },

  async createPatient(data: any) {
    return { id: 'patient_123', ...data };
  },

  async getPatient(id: string) {
    return null;
  },

  async updatePatient(id: string, data: any) {
    return { id, ...data };
  },

  async deletePatient(id: string) {
  },

  async listAppointments() {
    return [];
  },

  async createAppointment(data: any) {
    return { id: 'appointment_123', ...data };
  },

  async listPrescriptions() {
    return [];
  },

  async createPrescription(data: any) {
    return { id: 'prescription_123', ...data };
  },

  async getComplianceReport() {
    return { status: 'compliant', reportDate: new Date() };
  },
};

// Healthcare vertical service stub — placeholder until real implementation

export const healthcareService = {
  async listPatients(accountId: string) {
    return [];
  },

  async createPatient(accountId: string, data: unknown) {
    return { id: 'patient_123', accountId, ...data };
  },

  async getPatient(accountId: string, id: string) {
    return null;
  },

  async updatePatient(accountId: string, id: string, data: unknown) {
    return { id, accountId, ...data };
  },

  async deletePatient(accountId: string, id: string) {
  },

  async listAppointments(accountId: string) {
    return [];
  },

  async createAppointment(accountId: string, data: unknown) {
    return { id: 'appointment_123', accountId, ...data };
  },

  async listPrescriptions(accountId: string) {
    return [];
  },

  async createPrescription(accountId: string, data: unknown) {
    return { id: 'prescription_123', accountId, ...data };
  },
};

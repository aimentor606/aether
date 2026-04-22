import {
  policiesService,
  claimsService,
  leadsService,
  documentsService,
  complianceService,
} from '@aether/vertical-insurance';

export {
  policiesService,
  claimsService,
  leadsService,
  documentsService,
  complianceService,
};

export const insuranceService = {
  // Policies
  async listPolicies(accountId: string, options?: { limit?: number; offset?: number }) {
    return policiesService.listAll(accountId, options);
  },
  async createPolicy(accountId: string, data: unknown) {
    return policiesService.create(accountId, data);
  },
  async getPolicy(accountId: string, id: string) {
    return policiesService.getById(accountId, id);
  },
  async updatePolicy(accountId: string, id: string, data: unknown) {
    return policiesService.update(accountId, id, data);
  },
  async deletePolicy(accountId: string, id: string) {
    return policiesService.delete(accountId, id);
  },

  // Claims
  async listClaims(accountId: string, options?: { limit?: number; offset?: number }) {
    return claimsService.listAll(accountId, options);
  },
  async createClaim(accountId: string, data: unknown) {
    return claimsService.create(accountId, data);
  },
  async getClaim(accountId: string, id: string) {
    return claimsService.getById(accountId, id);
  },
  async updateClaim(accountId: string, id: string, data: unknown) {
    return claimsService.update(accountId, id, data);
  },
  async deleteClaim(accountId: string, id: string) {
    return claimsService.delete(accountId, id);
  },

  // Leads
  async listLeads(accountId: string, options?: { limit?: number; offset?: number }) {
    return leadsService.listAll(accountId, options);
  },
  async createLead(accountId: string, data: unknown) {
    return leadsService.create(accountId, data);
  },
  async getLead(accountId: string, id: string) {
    return leadsService.getById(accountId, id);
  },
  async updateLead(accountId: string, id: string, data: unknown) {
    return leadsService.update(accountId, id, data);
  },
  async deleteLead(accountId: string, id: string) {
    return leadsService.delete(accountId, id);
  },

  // Documents
  async listDocuments(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    return documentsService.listAll(accountId, options);
  },
  async createDocument(accountId: string, data: unknown) {
    return documentsService.create(accountId, data);
  },

  // Compliance
  async listCompliance(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    return complianceService.listAll(accountId, options);
  },
  async createCompliance(accountId: string, data: unknown) {
    return complianceService.create(accountId, data);
  },
};

import {
  portfoliosService,
  riskAssessmentsService,
  financialPlansService,
  leadsService,
  documentsService,
  complianceService,
} from '@aether/vertical-advisor';

export {
  portfoliosService,
  riskAssessmentsService,
  financialPlansService,
  leadsService,
  documentsService,
  complianceService,
};

export const advisorService = {
  // Portfolios
  async listPortfolios(accountId: string, options?: { limit?: number; offset?: number }) {
    return portfoliosService.listAll(accountId, options);
  },
  async createPortfolio(accountId: string, data: unknown) {
    return portfoliosService.create(accountId, data);
  },
  async getPortfolio(accountId: string, id: string) {
    return portfoliosService.getById(accountId, id);
  },
  async updatePortfolio(accountId: string, id: string, data: unknown) {
    return portfoliosService.update(accountId, id, data);
  },
  async deletePortfolio(accountId: string, id: string) {
    return portfoliosService.delete(accountId, id);
  },

  // Risk Assessments
  async listRiskAssessments(accountId: string, options?: { limit?: number; offset?: number }) {
    return riskAssessmentsService.listAll(accountId, options);
  },
  async createRiskAssessment(accountId: string, data: unknown) {
    return riskAssessmentsService.create(accountId, data);
  },
  async getRiskAssessment(accountId: string, id: string) {
    return riskAssessmentsService.getById(accountId, id);
  },
  async updateRiskAssessment(accountId: string, id: string, data: unknown) {
    return riskAssessmentsService.update(accountId, id, data);
  },
  async deleteRiskAssessment(accountId: string, id: string) {
    return riskAssessmentsService.delete(accountId, id);
  },

  // Financial Plans
  async listFinancialPlans(accountId: string, options?: { limit?: number; offset?: number }) {
    return financialPlansService.listAll(accountId, options);
  },
  async createFinancialPlan(accountId: string, data: unknown) {
    return financialPlansService.create(accountId, data);
  },
  async getFinancialPlan(accountId: string, id: string) {
    return financialPlansService.getById(accountId, id);
  },
  async updateFinancialPlan(accountId: string, id: string, data: unknown) {
    return financialPlansService.update(accountId, id, data);
  },
  async deleteFinancialPlan(accountId: string, id: string) {
    return financialPlansService.delete(accountId, id);
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

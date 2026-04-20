// Retail vertical service stub — placeholder until real implementation

export const retailService = {
  async listInventory(accountId: string) {
    return [];
  },

  async createInventoryItem(accountId: string, data: unknown) {
    return { id: 'inventory_123', accountId, ...data };
  },

  async getInventoryItem(accountId: string, id: string) {
    return null;
  },

  async updateInventoryItem(accountId: string, id: string, data: unknown) {
    return { id, accountId, ...data };
  },

  async deleteInventoryItem(accountId: string, id: string) {
  },

  async listSales(accountId: string) {
    return [];
  },

  async createSale(accountId: string, data: unknown) {
    return { id: 'sale_123', accountId, ...data };
  },

  async listLoyaltyPrograms(accountId: string) {
    return [];
  },

  async createLoyaltyProgram(accountId: string, data: unknown) {
    return { id: 'loyalty_123', accountId, ...data };
  },
};

export const retailService = {
  async listInventory() {
    return [];
  },

  async createInventoryItem(data: any) {
    return { id: 'inventory_123', ...data };
  },

  async getInventoryItem(id: string) {
    return null;
  },

  async updateInventoryItem(id: string, data: any) {
    return { id, ...data };
  },

  async deleteInventoryItem(id: string) {
  },

  async listSales() {
    return [];
  },

  async createSale(data: any) {
    return { id: 'sale_123', ...data };
  },

  async listLoyaltyPrograms() {
    return [];
  },

  async createLoyaltyProgram(data: any) {
    return { id: 'loyalty_123', ...data };
  },

  async getComplianceReport() {
    return { status: 'compliant', reportDate: new Date() };
  },
};

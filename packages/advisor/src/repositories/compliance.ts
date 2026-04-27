import { eq, and, desc } from 'drizzle-orm';
import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { complianceRecords } from '../schemas';

const base = createBaseRepository({ table: complianceRecords, db });

export const complianceRepository = {
  ...base,
  async findAll(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    const conditions = [eq(complianceRecords.accountId, accountId)];
    if (options?.entityType) conditions.push(eq(complianceRecords.entityType, options.entityType));
    if (options?.entityId) conditions.push(eq(complianceRecords.entityId, options.entityId));
    return db.query.complianceRecords.findMany({
      where: and(...conditions),
      orderBy: desc(complianceRecords.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },
};

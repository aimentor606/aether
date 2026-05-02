import { eq, and, desc } from 'drizzle-orm';
import { createBaseRepository } from './repository';
import { leads, documents, complianceRecords } from '@aether/db';
import type { Database } from './db';

export function createLeadsRepository(db: Database) {
  const base = createBaseRepository({ table: leads, db });

  return {
    ...base,
    async findAll(accountId: string, options?: { limit?: number; offset?: number; vertical?: string }) {
      const conditions = options?.vertical
        ? and(eq(leads.accountId, accountId), eq(leads.vertical, options.vertical as any))
        : eq(leads.accountId, accountId);
      return db.query.leads.findMany({
        where: conditions,
        orderBy: desc(leads.createdAt),
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      });
    },
  };
}

export function createDocumentsRepository(db: Database) {
  const base = createBaseRepository({ table: documents, db });

  return {
    ...base,
    async findAll(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
      const conditions = [eq(documents.accountId, accountId)];
      if (options?.entityType) conditions.push(eq(documents.entityType, options.entityType));
      if (options?.entityId) conditions.push(eq(documents.entityId, options.entityId));
      return db.query.documents.findMany({
        where: and(...conditions),
        orderBy: desc(documents.createdAt),
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      });
    },
  };
}

export function createComplianceRepository(db: Database) {
  const base = createBaseRepository({ table: complianceRecords, db });

  return {
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
}

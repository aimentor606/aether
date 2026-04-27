import { eq, and, desc } from 'drizzle-orm';
import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { documents } from '../schemas';

const base = createBaseRepository({ table: documents, db });

export const documentsRepository = {
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

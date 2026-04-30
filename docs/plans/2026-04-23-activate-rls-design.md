# Postgres RLS Transaction Wrapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Postgres Row Level Security (RLS) enforcement using a transaction wrapper approach to securely isolate tenant data.

**Architecture:** We will create a `withTenantContext` helper in the `@aether/db` package that takes an `accountId` and a callback. It will start a database transaction, execute `SELECT set_config('aether.current_account_id', '...', true)`, and then execute the callback passing the wrapped transaction object. This ensures RLS policies are applied to all operations within the callback while safely reverting the config after the transaction closes.

**Tech Stack:** Drizzle ORM, Postgres, TypeScript, Bun test.

---

### Task 1: Create Tenant Context DB Helper

**Files:**
- Create: `packages/db/src/rls.ts`
- Test: `packages/db/src/__tests__/rls.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, test } from "bun:test";
import { withTenantContext } from "../rls";

describe("withTenantContext", () => {
  test("should set local session variable within transaction", async () => {
    // Assuming db client is properly configured for the test environment
    const result = await withTenantContext("test-account-id", async (tx) => {
        const res = await tx.execute('SELECT current_setting(\'aether.current_account_id\', true) as current_account');
        return res[0].current_account;
    });
    expect(result).toBe("test-account-id");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/db && bun test src/__tests__/rls.test.ts`
Expected: FAIL with "Cannot find module '../rls'" or "withTenantContext is not defined"

**Step 3: Write minimal implementation**

```typescript
import { db } from "./client";
import { sql } from "drizzle-orm";
import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "./schema/aether";

type Schema = typeof schema;
type DbTransaction = PgTransaction<PostgresJsQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

export async function withTenantContext<T>(
  accountId: string,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('aether.current_account_id', ${accountId}, true)`);
    return callback(tx);
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/db && bun test src/__tests__/rls.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/db/src/rls.ts packages/db/src/__tests__/rls.test.ts
git commit -m "feat(db): add withTenantContext RLS helper"
```

### Task 2: Export helper from DB package

**Files:**
- Modify: `packages/db/src/index.ts` (or create if it doesn't exist, or update main entrypoint `package.json` points to)

**Step 1: Write the failing test**
*(Skipping explicit unit test, we will verify with a build check)*

**Step 2: Write minimal implementation**

```typescript
export * from "./rls";
```

**Step 3: Run build to verify**

Run: `pnpm build --filter @aether/db`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): export rls helpers"
```
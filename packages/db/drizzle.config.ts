import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/schema/aether.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['aether'],
  // Only manage these specific tables. basejump.* and api_keys are managed
  // externally (Supabase / cloud migrations) and excluded from drizzle push.
  // Credit/billing tables are now under aether.* schema.
  tablesFilter: [
    'aether.*',
  ],
});

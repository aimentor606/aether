import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/schema/acme.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['acme'],
  // Only manage these specific tables. basejump.* and api_keys are managed
  // externally (Supabase / cloud migrations) and excluded from drizzle push.
  // Credit/billing tables are now under acme.* schema.
  tablesFilter: [
    'acme.*',
  ],
});

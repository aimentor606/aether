import { z } from 'zod';

const RuntimeEnvSchema = z.object({
  SUPABASE_URL: z
    .string()
    .url('SUPABASE_URL must be a valid URL')
    .optional()
    .default('https://placeholder.invalid'),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'SUPABASE_ANON_KEY is required')
    .optional()
    .default('placeholder-anon-key'),
  BACKEND_URL: z
    .string()
    .url('BACKEND_URL must be a valid URL')
    .optional()
    .default('http://localhost:8008/v1'),
  ENV_MODE: z.enum(['local', 'cloud']).default('local'),
  APP_URL: z
    .string()
    .url('APP_URL must be a valid URL')
    .default('http://localhost:3000'),
  /** Default sandbox container name — used as fallback before the store hydrates */
  SANDBOX_ID: z.string().optional().default('aether-sandbox'),
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function parseRuntimeEnv(raw: Partial<RuntimeEnv>): RuntimeEnv {
  return RuntimeEnvSchema.parse({
    ENV_MODE: 'local',
    ...raw,
  });
}

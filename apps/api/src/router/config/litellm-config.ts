import { z } from 'zod';

const envSchema = z.object({
  LITELLM_URL: z
    .string()
    .optional()
    .default('http://litellm:4000')
    .refine((v) => /^https?:\/\//.test(v), {
      message: 'LITELLM_URL must be a valid HTTP(S) URL',
    }),
  LITELLM_MASTER_KEY: z.string().min(1, 'LITELLM_MASTER_KEY is required'),
  LITELLM_TIMEOUT_MS: z
    .string()
    .optional()
    .default('60000')
    .transform((v) => {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? 60000 : n;
    }),
  LITELLM_NUM_RETRIES: z
    .string()
    .optional()
    .default('3')
    .transform((v) => {
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? 3 : n;
    }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`[LiteLLM] Invalid LiteLLM environment configuration: ${message}`);
}

export const litellmConfig = parsed.data;

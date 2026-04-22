import { Context, Next } from 'hono';

/**
 * Explicitly marks unfinished verticals as preview-only.
 * We return 501 instead of silently serving stubbed data.
 */
export function previewOnly(vertical: 'healthcare' | 'retail') {
  return async (c: Context, _next: Next) => {
    return c.json(
      {
        success: false,
        error: `${vertical} vertical is in preview and not available in this environment yet`,
        meta: {
          vertical,
          status: 'preview',
          available: false,
        },
      },
      501,
    );
  };
}

import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

// CORS origins: production domains + localhost for local dev + any extras from env.
const cloudOrigins = [
  'https://www.aether.dev',
  'https://aether.dev',
  'https://dev.aether.dev',
  'https://new-dev.aether.dev',
  'https://dev-new.aether.dev',
  'https://staging.aether.dev',
  'https://aether.cloud',
  'https://www.aether.cloud',
  'https://new.aether.dev',
];

const justavpsOrigins = [
  'https://justavps.com',
  'http://localhost:3001',
];

const localOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const extraOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const corsOrigins = [
  ...new Set([
    ...cloudOrigins,
    ...justavpsOrigins,
    ...localOrigins,
    ...extraOrigins,
  ]),
];

export const corsMiddleware: MiddlewareHandler = cors({
  origin: corsOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-aether-Token', 'X-Api-Key', 'Accept'],
  credentials: true,
});

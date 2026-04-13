/**
 * @acme/sdk — Unified SDK for Aether applications.
 *
 * Core modules (no React dependency):
 *   import { ... } from '@acme/sdk'
 *   import { ... } from '@acme/sdk/api'
 *   import { ... } from '@acme/sdk/auth'
 *   import { ... } from '@acme/sdk/realtime'
 *   import { ... } from '@acme/sdk/llm'
 *   import { ... } from '@acme/sdk/a2ui'
 *
 * React-specific (requires React):
 *   import { ... } from '@acme/sdk/client'
 *
 * Server-specific (Node.js only):
 *   import { ... } from '@acme/sdk/server'
 */

export * from './auth';
export * from './api';
export * from './realtime';
export * from './llm';
export * from './a2ui';

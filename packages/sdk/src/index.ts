/**
 * @aether/sdk — Unified SDK for Aether applications.
 *
 * Core modules (no React dependency):
 *   import { ... } from '@aether/sdk'
 *   import { ... } from '@aether/sdk/api'
 *   import { ... } from '@aether/sdk/auth'
 *   import { ... } from '@aether/sdk/realtime'
 *   import { ... } from '@aether/sdk/llm'
 *   import { ... } from '@aether/sdk/a2ui'
 *
 * React-specific (requires React):
 *   import { ... } from '@aether/sdk/client'
 *
 * Server-specific (Node.js only):
 *   import { ... } from '@aether/sdk/server'
 */

export * from './auth';
export * from './api';
export * from './realtime';
export * from './llm';
export * from './a2ui';

/**
 * @aether/sdk/auth
 *
 * Supabase Auth wrappers for client and server contexts.
 */

export { createAuthClient } from './client';
export { createAuthServer } from './server';
export type { AuthClient, AuthServer, Session, User } from './types';

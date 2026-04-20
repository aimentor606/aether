import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthServer, Session, User } from './types';

/**
 * Create a server-side auth client.
 * Uses Supabase SSR for cookie-based session management.
 */
export function createAuthServer(supabase: SupabaseClient): AuthServer {
  return {
    supabase,

    async getSession(): Promise<Session | null> {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },

    async getUser(): Promise<User | null> {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },

    async isAdmin(): Promise<boolean> {
      const user = await this.getUser();
      if (!user) return false;
      const role = (user.app_metadata as Record<string, unknown>)?.role;
      return role === 'admin';
    },
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthClient, Session, User } from './types';

/**
 * Create a browser-side auth client.
 * Wraps Supabase client auth with Aether-specific helpers.
 */
export function createAuthClient(supabase: SupabaseClient): AuthClient {
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

    async signInWithEmail(email: string, password: string) {
      return supabase.auth.signInWithPassword({ email, password });
    },

    async signOut() {
      return supabase.auth.signOut();
    },

    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
      return supabase.auth.onAuthStateChange(callback);
    },
  };
}

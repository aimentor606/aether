import type { SupabaseClient, User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

export type User = SupabaseUser;
export type Session = SupabaseSession;

export interface AuthClient {
  supabase: SupabaseClient;
  getSession(): Promise<Session | null>;
  getUser(): Promise<User | null>;
  signInWithEmail(email: string, password: string): Promise<unknown>;
  signOut(): Promise<unknown>;
  onAuthStateChange(callback: (event: string, session: Session | null) => void): unknown;
}

export interface AuthServer {
  supabase: SupabaseClient;
  getSession(): Promise<Session | null>;
  getUser(): Promise<User | null>;
  isAdmin(): Promise<boolean>;
}

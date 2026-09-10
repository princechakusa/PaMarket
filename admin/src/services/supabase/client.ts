import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adminEnvironment } from './env';
import type { Database } from './database.types';

export const ADMIN_AUTH_STORAGE_KEY = 'pamarket.admin.v2.auth';
let browserClient: SupabaseClient<Database> | null | undefined;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (browserClient !== undefined) return browserClient;
  if (adminEnvironment.mode !== 'live' || adminEnvironment.configurationError) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient<Database>(adminEnvironment.supabaseUrl!, adminEnvironment.publishableKey!, {
    auth: {
      storageKey: ADMIN_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}

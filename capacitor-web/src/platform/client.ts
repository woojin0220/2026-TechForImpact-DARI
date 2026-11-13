import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readPlatformConfig } from './config';

let client: SupabaseClient | null | undefined;

/** One shared client, or null when this build has no platform settings. */
export function platformClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readPlatformConfig();
  client = config ? createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'dari.auth.v1' },
  }) : null;
  return client;
}

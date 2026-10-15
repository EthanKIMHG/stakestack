import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();

let client: SupabaseClient | null | undefined;

/**
 * Secret-key client for the few writes the publishable key must not make: member stacks, after the
 * caller's Privy session has been verified. Server only; null when SUPABASE_SECRET_KEY is not set.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
  client = url && key && !url.includes('example.supabase.co')
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return client;
}

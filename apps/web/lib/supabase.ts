import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('example.supabase.co')) return null;
  client ??= createClient(url, key, { auth: { persistSession: false } });
  return client;
}
export const isrSeconds = Number(process.env.NEXT_PUBLIC_ISR_SECONDS ?? 300);

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

export type Db = SupabaseClient;

export function db(): Db {
  if (!config.supabaseUrl || !config.supabaseServiceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required (or pass --dry-run)');
  return createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false } });
}

export async function upsert(client: Db, table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client.from(table).upsert(rows.slice(i, i + 500), { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

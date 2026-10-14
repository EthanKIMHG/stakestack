import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

export type Db = SupabaseClient;

/** Request/row counters so every run can report its database footprint. */
export const dbStats = { requests: 0, rowsWritten: 0, bytesIn: 0, bytesOut: 0 };

const countingFetch: typeof fetch = async (input, init) => {
  dbStats.requests += 1;
  if (init?.body && typeof init.body === 'string') dbStats.bytesOut += init.body.length;
  const res = await fetch(input, init);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len) dbStats.bytesIn += len;
  return res;
};

export function db(): Db {
  if (!config.supabaseUrl || !config.supabaseServiceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required (or pass --dry-run)');
  return createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false }, global: { fetch: countingFetch } });
}

export async function upsert(client: Db, table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await client.from(table).upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
    dbStats.rowsWritten += chunk.length;
  }
}

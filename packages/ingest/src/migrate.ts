import { repoRoot } from './env';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';

/**
 * Apply supabase/migrations/*.sql in filename order. Tracks applied files in
 * public.schema_migrations so re-runs are no-ops. Portable replacement for psql.
 */
async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('SUPABASE_DB_URL is required');
  const dir = resolve(repoRoot, process.env.MIGRATIONS_DIR ?? 'supabase/migrations');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const { rows } = await client.query<{ name: string }>('select name from public.schema_migrations');
    const done = new Set(rows.map(r => r.name));
    for (const f of files) {
      if (done.has(f)) { console.log(`skip    ${f}`); continue; }
      const sql = readFileSync(join(dir, f), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (name) values ($1)', [f]);
        await client.query('commit');
        console.log(`applied ${f}`);
      } catch (e) { await client.query('rollback'); throw new Error(`${f}: ${(e as Error).message}`); }
    }
    const { rows: t } = await client.query<{ n: string }>("select count(*)::text as n from information_schema.tables where table_schema='public'");
    console.log(`public tables: ${t[0]?.n}`);
  } finally { await client.end(); }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });

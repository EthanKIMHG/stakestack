# Supabase

- `migrations/` are plain SQL, applied in filename order by `pnpm db:migrate` (psql) or by the Supabase CLI (`supabase db push`).
- Row Level Security: every reference table is world-readable; only `stacks` has write policies (anonymous insert for share links, owner-only update/delete).
- Grants: since 2026-10-30 Supabase no longer grants `anon`, `authenticated` and `service_role` access to new tables in `public` automatically. Every migration that creates a table, sequence or view must grant them in the same file, or the Data API answers "permission denied" on a fresh project, a preview branch or `supabase db reset`. Pattern (see `0001_init.sql`):
  - reference data: `grant select ... to anon, authenticated;` and `grant select, insert, update, delete ... to service_role;`
  - `bigserial`/identity columns: `grant usage, select on <table>_id_seq to service_role;`
  - server-only tables such as `stack_owners`: grant `service_role` only, and `revoke all ... from anon, authenticated` so a default grant never leaks in.
  - RLS still decides which rows a role sees; a grant alone does not expose data on a table with RLS on and no policy.
- The ingester uses a secret key (`sb_secret_...`, legacy service_role) and bypasses RLS. The web app only ever uses the publishable key (`sb_publishable_...`, legacy anon).
- `stack_timeline(selection jsonb, limit int)` is the single query behind the stack page and the RSS/JSON feeds.
- Free tier note: projects pause after a week without traffic. The ingest cron keeps it awake.

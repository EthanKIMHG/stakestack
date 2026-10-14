# Supabase

- `migrations/` are plain SQL, applied in filename order by `pnpm db:migrate` (psql) or by the Supabase CLI (`supabase db push`).
- Row Level Security: every reference table is world-readable; only `stacks` has write policies (anonymous insert for share links, owner-only update/delete).
- The ingester uses a secret key (`sb_secret_...`, legacy service_role) and bypasses RLS. The web app only ever uses the publishable key (`sb_publishable_...`, legacy anon).
- `stack_timeline(selection jsonb, limit int)` is the single query behind the stack page and the RSS/JSON feeds.
- Free tier note: projects pause after a week without traffic. The ingest cron keeps it awake.

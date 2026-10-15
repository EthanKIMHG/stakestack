-- Record per-run database footprint, trigger source and revalidation result,
-- so operators can audit the cron without opening GitHub Actions logs.
alter table ingest_runs add column if not exists db_requests int;
alter table ingest_runs add column if not exists db_rows_written int;
alter table ingest_runs add column if not exists revalidate_status text;   -- e.g. "200", "401", "skipped:not-stakestack", "none"
alter table ingest_runs add column if not exists trigger text;             -- schedule | workflow_dispatch | local

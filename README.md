# stakestack

Open-source composer and release-intelligence tracker for Ethereum staking stacks.

Pick your exact stack (EL, CL, VC, DVT such as Charon or SSV, remote signers, MEV sidecars,
protocol modules such as Lido CSM or Rocket Pool, node managers, monitoring) and get:

- a release timeline limited to *your* components, each release scored with evidence
  (`critical / high / recommended / optional / unassessed`) and flagged (`security`, `mandatory`, `hardfork`, `breaking`, ...)
- **per-network readiness** in rollout order (sepolia → hoodi → mainnet): required version vs latest vs what you run
- fork-wave pages: the same upgrade across testnets and mainnet with activation times and required client versions
- RSS / JSON feeds per stack for Slack, Telegram, n8n or anything else

Everything is public read; the catalog is YAML in this repo so adding a tool is a pull request.

## Layout

```
catalog/            components (78), slots + composition rules, networks + fork waves   ← edit here
packages/shared/    types, catalog loader/validator, compose() engine, readiness engine
packages/ingest/    GitHub ingester (GraphQL batches + REST w/ ETag), rule-based assessment, catalog sync
apps/web/           Next.js 15 app (Vercel): builder, stack pages, upgrades, feeds
supabase/           SQL migrations (RLS on), README
.github/workflows/  ingest cron (30 min), catalog validate+sync, CI
docs/               GITHUB_API_SPEC.md, ASSESSMENT.md, ARCHITECTURE.md
```

## Quick start (local)

```bash
pnpm install
cp .env.example .env        # fill Supabase + GITHUB_TOKEN (see comments in the file)
pnpm catalog:validate
pnpm db:migrate             # psql against SUPABASE_DB_URL
pnpm catalog:sync           # YAML -> Supabase
pnpm ingest -- --backfill   # first run; later runs fetch 5 releases per repo
pnpm dev                    # http://localhost:3000
```

Without Supabase the web app still runs in read-only mode from the YAML catalog
(no releases, no saving).

## Deploy

1. **Supabase**: create a project, run `pnpm db:migrate`.
2. **GitHub**: fork, add secrets `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (sb_secret_...),
   `STAKESTACK_GITHUB_TOKEN` (fine-grained PAT, public repos, no permissions), `REVALIDATE_SECRET`;
   variables `NEXT_PUBLIC_SITE_URL` and optional `INGEST_*` ceilings. Enable Actions. Run `catalog` once (push to main), then `ingest` with `backfill=true`.
3. **Vercel**: import `apps/web` with root directory `apps/web` or use the root `vercel.json`; set the `[web]` variables from `.env.example`.

## GitHub API budget

The ingester is built to share a token with other projects: 2 GraphQL requests
(~6 points) per poll for the whole catalog, REST only for advisories with ETags
(304s are free), hard per-run ceilings and a remaining-quota floor. Details and
the exact query shape: [docs/GITHUB_API_SPEC.md](docs/GITHUB_API_SPEC.md).

## Contributing a component

Add an entry to `catalog/components/<role>.yaml`, run `pnpm catalog:validate`, open a PR.
CI checks the schema and that the repo exists. See [catalog/README.md](catalog/README.md).

## Status

Scaffold. Rule-based assessment and the builder/readiness engines have unit tests;
notifications (email/Telegram), LLM-assisted assessment and auth-backed stacks are phase 2.

MIT.

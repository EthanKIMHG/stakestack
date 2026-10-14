# Architecture

```
catalog/*.yaml  ──(pnpm catalog:sync, on push)──▶  Supabase (Postgres + RLS)
                                                        ▲            │
GitHub Actions cron (every 30 min)                      │            │ anon key, read-only
  packages/ingest: GraphQL batches ──────── upsert ─────┘            ▼
  + REST advisories w/ ETag                                  apps/web (Next.js on Vercel)
  + rule-based assessment                                      /            stack builder
  + POST /api/revalidate                                       /s/<slug>    stack timeline + per-network readiness
                                                               /c/<slug>    component page
                                                               /upgrades    fork waves: sepolia -> hoodi -> mainnet
                                                               /api/feed/<slug>.(rss|json)
```

## Why the ingester is not a Vercel function

- Vercel Hobby cron is once per day; releases need ~30 min latency.
- A forked repo gets a working ingester for free with Actions.
- The ingester keeps on-disk state (ETags/cursors); Actions cache fits that.

## Data flow for one release

1. GraphQL batch returns the release node.
2. `extractReleases` filters drafts, marks `is_prerelease` (GitHub flag OR tag not matching `stable_tag_pattern`).
3. `assessRelease` produces severity/flags/evidence.
4. `releases` + `release_assessments(source='rules')` are upserted.
5. `/api/revalidate` busts ISR for affected component and stack pages.

## Stack = selection JSON

```json
{ "network": ["hoodi", "mainnet"], "execution": ["nethermind"], "consensus": ["lighthouse"],
  "validator": ["lighthouse"], "dvt": ["charon"], "remote-signer": ["web3signer"], "mev": ["mev-boost"],
  "monitoring": ["ethereum-metrics-exporter"] }
```

`compose()` (packages/shared) validates it against `slots.yaml` rules; the same
function runs in the browser and on the server, so the UI and the feeds never
disagree.

## Per-network readiness

`computeReadiness()` takes the stack, its networks ordered by
`rollout_sequence` (sepolia, hoodi, mainnet), the next upgrade per network and
the ingested releases. Testnets accept pre-release tags as "latest"; mainnet
does not. If the operator stores `running_versions`, the state becomes
`ready` / `behind`; otherwise it is `update-available` / `unknown`.

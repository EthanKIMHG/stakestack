# GitHub API usage spec

stakestack's ingester is designed so that a single personal access token can be
shared with other automation without starving it. These rules are enforced in
code (`packages/ingest/src/github/budget.ts`), not just documented.

## Principles

1. **One GraphQL request per 40 repos, not one request per repo.**
   Releases for the whole catalog (~75 repos) are fetched in 2 requests using
   aliases. GitHub charges GraphQL by node count: `ceil(nodes / 100)` points.
   40 repos x (1 repo node + 5 release nodes) = 240 nodes = **3 points**.
   A full poll of the catalog costs ~6 points out of 5,000 per hour.

2. **Every GraphQL query requests `rateLimit { cost remaining resetAt }`.**
   The budget tracker uses the real cost returned by GitHub, never an estimate.

3. **REST only where GraphQL cannot go, and always with `If-None-Match`.**
   Repository security advisories are REST-only. A `304 Not Modified` does
   **not** count against the rate limit, so after the first run daily advisory
   polling of ~75 repos costs ~0 requests. ETags are persisted in
   `packages/ingest/.cache/state.json` and restored via `actions/cache`.

4. **Hard per-run ceilings.** Defaults: 25 GraphQL points, 120 REST requests.
   Exceeding either throws `BudgetExceeded`; the run saves state and exits 0.

5. **Floors on the token's remaining quota.** If the token has fewer than
   `INGEST_MIN_REMAINING_POINTS` (1,000) GraphQL points or
   `INGEST_MIN_REMAINING_REST` (1,000) REST requests left, the run stops. That
   quota is left for other projects sharing the token.

6. **No polling of unchanged data.** The cache stores the newest release
   timestamp per repo. On a normal poll only releases newer than
   (newest seen - 7 days) are re-assessed and upserted; the 7-day window
   catches teams editing release notes after publishing.

7. **Backfill is explicit.** First sight of a repo fetches 30 releases; after
   that 5. `--backfill` or `workflow_dispatch(backfill=true)` re-fetches 30.

8. **Token choice.** In GitHub Actions the workflow uses the secret
   `STAKESTACK_GITHUB_TOKEN` when it exists, otherwise the built-in
   `github.token`. The built-in token has its own repo-scoped budget
   (1,000 requests/hour), which never competes with a personal token used by
   other projects, and one run only costs ~2 GraphQL points. With the built-in
   token the remaining-quota floors default to 100 instead of 1,000. For local
   runs use a fine-grained PAT with *Public repositories* access and no
   permissions.

9. **Identify yourself.** `INGEST_USER_AGENT` must contain a URL. GitHub
   throttles anonymous-looking agents harder.

10. **Retry with backoff, never tight loops.** 3 attempts, 1s/2s/4s. A 403 or
    429 is not retried inside the run; the next cron run picks it up.

## Budget per day (defaults)

| item                       | calls/day | cost/day            |
|----------------------------|-----------|---------------------|
| releases poll (48 runs)    | 96 GraphQL| ~290 points         |
| advisories (first run)     | ~75 REST  | 75 requests         |
| advisories (steady state)  | ~75 REST  | ~0 (304s)           |
| catalog PR repo check      | n changed | n requests          |
| **total**                  |           | **< 6% of hourly limit, spread over the day** |

## GraphQL query shape

```graphql
query StakestackReleases {
  rateLimit { cost remaining resetAt limit }
  r0: repository(owner: "ethereum", name: "go-ethereum") {
    nameWithOwner isArchived pushedAt
    releases(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes { id databaseId tagName name isPrerelease isDraft publishedAt createdAt url description }
    }
  }
  r1: repository(owner: "sigp", name: "lighthouse") { ... }
  # tags only for components with release_source: tags
  r2: repository(owner: "eth-clients", name: "hoodi") {
    nameWithOwner isArchived pushedAt
    releases(first: 5, ...) { nodes { ... } }
    refs(refPrefix: "refs/tags/", first: 10, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
      nodes { name target { oid ... on Commit { committedDate } ... on Tag { tagger { date } } } }
    }
  }
}
```

## REST calls used

| endpoint                                              | when                         | headers                         |
|-------------------------------------------------------|------------------------------|---------------------------------|
| `GET /repos/{o}/{r}/security-advisories?state=published` | every 24h per repo        | `If-None-Match: <etag>`         |
| `GET /repos/{o}/{r}`                                  | catalog PR CI, changed repos | none                            |
| `GET /rate_limit`                                     | never in prod (free, but unnecessary: GraphQL returns it) | |

## What is deliberately not used

- Webhooks: would need a server endpoint per repo we do not own.
- `GET /repos/{o}/{r}/releases` REST polling per repo: 75 requests per poll vs 2 GraphQL requests.
- Search API: separate 30 req/min limit, no benefit.
- Repository `vulnerabilityAlerts` GraphQL field: requires admin on the repo.

# Release assessment

Every ingested release gets a rule-based assessment (`packages/ingest/src/assess/rules.ts`).
The output is a severity, a 0-100 score, flags, detected networks / fork wave,
and **evidence**: the sentences or table rows the score came from. The UI always
shows evidence next to a badge. If the rules find nothing the release is
`unassessed`, never silently `optional`.

## Severity

| severity      | meaning for an operator                                   | typical trigger                                |
|---------------|-----------------------------------------------------------|------------------------------------------------|
| `critical`    | upgrade now, likely a security fix                        | security flag + score >= 60                    |
| `high`        | upgrade before a deadline (fork) or the team says must    | mandatory / hardfork flag or score >= 60       |
| `recommended` | upgrade in the next maintenance window                    | score 25-59                                    |
| `optional`    | nothing urgent                                            | score 1-24                                     |
| `unassessed`  | no signal found; read the notes                           | score 0                                        |

Stack timelines rank by `score x component.priority_weight` so a Geth
`recommended` (weight 1.5) outranks a Grafana `recommended` (weight 0.3).

## Flags

`security`, `mandatory`, `hardfork`, `breaking`, `hotfix`, `prerelease`,
`testnet-only`, `performance`, `deprecation`.

`testnet-only` is set when a pre-release mentions testnets but not mainnet;
these show in the Hoodi/Sepolia timelines and are hidden from mainnet-only stacks.

## Client-specific parsers

| assessor           | source of truth in the notes                                  |
|--------------------|---------------------------------------------------------------|
| `lighthouse-table` | "Update Priority" table; High = 70, Medium = 40, Low = 10     |
| `reth-table`       | same table shape, rows per payload-builder class              |
| `nimbus-urgency`   | "Urgency guidance:" paragraph; must/required = 70, recommended = 40 |
| `geth-prose`       | "recommended for all users" 35, hotfix 40, security/DoS 45, "enables X fork on <network>" 50 |
| `teku-notes`       | non-empty "Breaking Changes" 25; "required for/before <fork>" 45 |
| `prysm-notes`      | "Security" heading 40; required 40 / recommended 20 near the top |
| `charon-notes`     | "breaking" 30; cluster-wide / coordinated upgrade 35          |
| `generic`          | keyword pass only                                             |

When a client-specific parser produced evidence, the keyword pass contributes at
half weight so that a long changelog cannot outrank the team's own statement.

## Fork wave detection

Mentions of `pectra|prague|electra`, `fusaka|fulu|osaka|peerdas`,
`glamsterdam|gloas|amsterdam|epbs`, `hegota|heze|bogota|focil` set `wave` and the
`hardfork` flag. Network words (`mainnet|hoodi|sepolia|holesky|ephemery`) fill
`networks`. These feed the per-network timeline: a release that mentions only
Hoodi appears under Hoodi.

## Overrides

`release_assessments.source` is `rules`, `llm` or `manual`. The view
`release_assessment_effective` prefers manual > llm > rules. To correct a
result, insert a `manual` row; nothing is ever edited in place.

## LLM assistance (phase 2, off by default)

When `ASSESS_LLM_ENABLED=true`, releases that rules leave `unassessed` and that
belong to components with `priority_weight >= 1` are summarised by an LLM with
the same output schema, stored with `source = 'llm'`, capped by
`ASSESS_LLM_MAX_RELEASES_PER_RUN`. The model must quote evidence from the notes;
responses without quotes are discarded.

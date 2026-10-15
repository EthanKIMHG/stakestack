# Release assessment

Every ingested release gets a rule-based assessment (`packages/ingest/src/assess/rules.ts`).
The output is a severity, a 0-100 score, flags, detected networks / fork wave,
and **evidence**: the sentences or table rows the rating came from. The UI always
shows evidence next to a badge. If the rules find nothing the release is
`unassessed`, never silently `optional`.

## How a release is read

1. **Text preparation.** HTML comments, code blocks, images, URLs and markdown
   markup are stripped, curly quotes are normalised. Machine-generated changelog
   lines (GitHub's `* title by @x in https://.../pull/N`, commit hashes, merge
   lines, Dependabot / Renovate bumps, "Full Changelog") are separated from the
   prose. Bullets a team wrote by hand stay prose even when they link a PR.
2. **The team's statement sets the level.** Two readers, applied to every
   component regardless of its `assessor`:
   - *Priority tables*: "Update Priority" / "Upgrade Priority" tables
     (Lighthouse, Anchor, Reth, SSV). Cells `high/critical/required/mandatory`,
     `medium/recommended`, `low/optional`. `Non-Staking Users` rows are ignored;
     rows named after a network (SSV) are scoped to it; clauses about other
     chains ("High for Gnosis, Low otherwise") are dropped.
   - *Statements* in the first ~2,500 characters of prose:

     | level  | wording                                                                                   |
     |--------|-------------------------------------------------------------------------------------------|
     | high   | high/critical-priority or -urgency, mandatory, must upgrade/update/run, required update / required for the fork, upgrade as soon as possible / promptly / immediately, urgent, upgrade X nodes before the fork, coordinated / cluster-wide upgrade |
     | medium | medium-urgency/priority, strongly/highly recommended, recommended update / for all (mainnet) users, recommend upgrading, should / encouraged to / advised to upgrade |
     | low    | low-urgency/priority, optional update, no need to upgrade                                 |

     Each statement is scoped to the networks named next to it ("`high-urgency`
     for Sepolia and `medium-urgency` for other networks"). Statements only about
     other chains (Gnosis, Chiado, L2s) are ignored. Negated or hedged wording
     ("not mandatory", "you may need to update", "only need to upgrade if"),
     advice in `If you are running X ...` sentences and vocabulary legends
     ("high-urgency: update as soon as you can") do not count.
3. **Signals** come from prose only:

   | signal           | weight | wording                                                                                  |
   |------------------|--------|------------------------------------------------------------------------------------------|
   | security         | 40     | security fix/patch/release/update/vulnerabilities/advisory, security-focused, vulnerable, CVE, GHSA, denial of service, DoS risk/attack/resistance, RCE, or a non-empty `Security` section. Not "performance and security", not "key security". In generated changelog lines only CVE / GHSA / "security fix" / "fixes a vulnerability" count, at 15. |
   | consensus safety | 25     | risk of slashing, slashing-protection fix, missed attestations/proposals, chain split, consensus bug, forked off, invalid block, loss of finality |
   | breaking         | 25     | non-empty `Breaking Changes` section (not `N/A`), "breaking changes" (not "upcoming"), requires resync / migration |
   | hotfix           | 20     | hotfix, critical bug/fix                                                                 |
   | fork readiness   | 5      | ready for / prepares for / supports the fork, `Gloas-ready` (not "NOT Gloas-ready")        |
   | deprecation, performance | 1 | flags only                                                                      |

4. **Forks.** A sentence that schedules a fork on an Ethereum network
   ("Amsterdam scheduled on Sepolia", "at epoch 353024", "fork epoch") sets the
   `hardfork` flag. When the notes state no level at all, a schedule also
   implies `high` for that network; when the team does state a level, theirs
   wins ("This RC is an optional update"). Gas-limit schedules are not fork
   schedules. A high or medium statement that names a fork ("high-urgency for
   Sepolia due to its Glamsterdam fork") also sets `hardfork`. A fork name that
   only appears in passing sets `wave` but not the flag.

## Severity

| severity      | with a team statement                    | without one                                                 | score band |
|---------------|------------------------------------------|-------------------------------------------------------------|------------|
| `critical`    | stated high + security signal            | security + (hotfix or consensus safety), signals >= 60       | 85-100     |
| `high`        | stated high                              | a risk signal (security, hotfix, consensus) and signals >= 60 | 60-84     |
| `recommended` | stated medium                            | signals 25-59                                               | 25-59      |
| `optional`    | stated low                               | signals 1-24                                                | 1-24       |
| `unassessed`  | -                                        | nothing found; read the notes                               | 0          |

Signals never lift a release above the level the team stated: a Lighthouse
`medium-priority` release with security fixes is `recommended` + `security`, not
`critical`. Within a level, signals move the score at half weight, clamped to
the band, so the score stays comparable for ranking.

Stack timelines rank by `score x component.priority_weight` so a Geth
`recommended` (weight 1.5) outranks a Grafana `recommended` (weight 0.3).
Specs and network configs are capped at `high`.

## Flags

`security`, `mandatory`, `hardfork`, `breaking`, `hotfix`, `prerelease`,
`testnet-only`, `performance`, `deprecation`.

`mandatory` is set only by explicit wording (must, required, mandatory, upgrade
before the fork). `testnet-only` is set when a pre-release mentions testnets but
not mainnet; these show in the Hoodi/Sepolia timelines and are hidden from
mainnet-only stacks.

The catalog's `assessor` field is kept for provenance. Since `2026.10.2` the
same readers run for every component, so generic components (Nethermind, Besu,
Erigon, Lodestar, Grandine, SSV, ...) get statement and table parsing too.

## Golden tests

`packages/ingest/src/__tests__/fixtures/releases.json` holds real release notes
(first 3,000 characters) with the rating an operator would expect and a `why`.
`pnpm test` runs them. When a client changes its release-note format, add the
new note there before changing the rules, and change an expectation only with a
reason in `why`.

## Re-assessing stored releases

The ingester only re-assesses releases inside its 7-day re-check window, so
bumping `ASSESSOR_VERSION` alone does not touch older releases. After changing
the rules, run:

```bash
pnpm reassess -- --dry-run              # before -> after table and changed releases, no writes
pnpm reassess                           # write release_assessments rows with source = 'rules'
pnpm reassess -- --component=lighthouse --limit=50
```

`llm` and `manual` rows are never touched and still take precedence.

## Overrides

`release_assessments.source` is `rules`, `llm` or `manual`. The view
`release_assessment_effective` prefers manual > llm > rules. To correct a
result, insert a `manual` row; nothing is ever edited in place.

## LLM assistance (phase 2, off by default)

When `ASSESS_LLM_ENABLED=true`, releases that rules leave `unassessed` and that
belong to components with `priority_weight >= 1` are summarised by an LLM with
the same output schema, stored with `source = 'llm'`, capped by
`ASSESS_LLM_MAX_RELEASES_PER_RUN`. The model must quote evidence from the notes;
responses without quotes are discarded. (Not implemented yet.)

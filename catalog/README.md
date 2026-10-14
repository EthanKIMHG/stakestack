# Catalog

The catalog is the source of truth for *what* stakestack tracks. It lives in git
so that adding a tool is a pull request, not a database write.

```
catalog/
  slots.yaml              slot definitions + composition rules
  networks.yaml           networks and network upgrades (forks) with required versions
  components/*.yaml       one file per role group; each file is a list of components
  schema/*.schema.json    JSON Schema used by `pnpm catalog:validate` and CI
```

`pnpm catalog:sync` (packages/ingest) upserts the catalog into Supabase. The web
app never reads YAML at runtime; it reads the synced tables.

## Adding a component

1. Append to the matching `components/<role>.yaml` (or create a new role file).
2. Required fields: `slug`, `name`, `roles`, `repo`, `status`, `assessor`.
3. Run `pnpm catalog:validate`.
4. Open a PR. CI validates the schema and checks that `repo` exists on GitHub.

## Assessors

`assessor` tells the ingester which release-note parser to use. See
`docs/ASSESSMENT.md` for the rule set of each one:

| assessor           | used by                              | signal parsed                                   |
|--------------------|--------------------------------------|-------------------------------------------------|
| `lighthouse-table` | Lighthouse, Siren, Anchor            | "Update Priority" markdown table (BN/VC rows)   |
| `reth-table`       | Reth                                 | "Update Priority" table (payload builders rows) |
| `nimbus-urgency`   | Nimbus eth2 / eth1                   | "Urgency guidance" paragraph                    |
| `geth-prose`       | Geth                                 | "recommended for all users", "hotfix", DoS text |
| `teku-notes`       | Teku, Besu, Web3Signer               | "Breaking Changes", "Additions and Improvements", security notes |
| `prysm-notes`      | Prysm                                | "Security", "Required", "Recommended" headings  |
| `charon-notes`     | Charon, CDVN                         | "Breaking", "Security", compatibility matrix    |
| `generic`          | everything else                      | keyword scoring only                            |

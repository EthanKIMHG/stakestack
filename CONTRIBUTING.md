# Contributing

- Catalog changes: edit YAML under `catalog/`, run `pnpm catalog:validate`, open a PR. One component per entry, `repo` must be the canonical GitHub repo.
- Assessor changes: add a fixture-style unit test in `packages/ingest/src/__tests__/assess.test.ts` using a real release-note excerpt. Bump `ASSESSOR_VERSION` when scoring changes so old rows can be re-assessed.
- Composition rules: every rule in `catalog/slots.yaml` needs `sources` (official docs) and `verified_at`; validation fails without them. Protocol policy that picks cannot express (fee recipient, relay allowlist, exit deadlines) goes in `then.checks`, each with its own `source`. Add a behaviour test in `packages/shared/src/__tests__/sources.test.ts`; the trigger test there already checks that the rule fires.
- Templates (`packages/shared/src/presets.ts`): cite `sources` and set `verified_at`. A template must compose with no errors or warnings.
- Network upgrade dates and required versions must link the EF announcement; set `verified: true` only with a source.
- Never add calls to GitHub outside `packages/ingest/src/github/`; everything must go through the `Budget`.

# Contributing

- Catalog changes: edit YAML under `catalog/`, run `pnpm catalog:validate`, open a PR. One component per entry, `repo` must be the canonical GitHub repo.
- Assessor changes: add a fixture-style unit test in `packages/ingest/src/__tests__/assess.test.ts` using a real release-note excerpt. Bump `ASSESSOR_VERSION` when scoring changes so old rows can be re-assessed.
- Composition rules: add a test in `packages/shared/src/__tests__/composer.test.ts`.
- Network upgrade dates and required versions must link the EF announcement; set `verified: true` only with a source.
- Never add calls to GitHub outside `packages/ingest/src/github/`; everything must go through the `Budget`.

import { repoRoot } from './env';
import { resolve } from 'node:path';

function num(name: string, def: number): number { const v = process.env[name]; return v ? Number(v) : def; }
function bool(name: string, def: boolean): boolean { const v = process.env[name]; return v ? v === 'true' || v === '1' : def; }

export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  githubToken: process.env.GITHUB_TOKEN ?? '',
  userAgent: process.env.INGEST_USER_AGENT ?? 'stakestack-ingest/0.1',
  budget: {
    graphqlPointsPerRun: num('INGEST_GRAPHQL_BUDGET_POINTS_PER_RUN', 25),
    restRequestsPerRun: num('INGEST_REST_BUDGET_REQUESTS_PER_RUN', 120),
    minRemainingPoints: num('INGEST_MIN_REMAINING_POINTS', 1000),
    minRemainingRest: num('INGEST_MIN_REMAINING_REST', 1000),
  },
  releasesPerRepo: num('INGEST_RELEASES_PER_REPO', 5),
  backfillReleasesPerRepo: num('INGEST_BACKFILL_RELEASES_PER_REPO', 30),
  reposPerBatch: num('INGEST_REPOS_PER_GRAPHQL_BATCH', 40),
  tagsPerRepo: num('INGEST_TAGS_PER_REPO', 10),
  advisoriesIntervalHours: num('INGEST_ADVISORIES_INTERVAL_HOURS', 24),
  cacheDir: resolve(repoRoot, process.env.INGEST_CACHE_DIR ?? 'packages/ingest/.cache'),
  dryRun: bool('INGEST_DRY_RUN', false) || process.argv.includes('--dry-run'),
  backfill: process.argv.includes('--backfill'),
  logLevel: (process.env.INGEST_LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  revalidateUrl: siteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ? `${siteOrigin(process.env.NEXT_PUBLIC_SITE_URL)}/api/revalidate` : '',
  revalidateSecret: process.env.REVALIDATE_SECRET ?? '',
};

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
export const log = {
  debug: (...a: unknown[]) => { if (levels[config.logLevel] <= 10) console.debug('[debug]', ...a); },
  info: (...a: unknown[]) => { if (levels[config.logLevel] <= 20) console.log('[info]', ...a); },
  warn: (...a: unknown[]) => { if (levels[config.logLevel] <= 30) console.warn('[warn]', ...a); },
  error: (...a: unknown[]) => console.error('[error]', ...a),
};

/** "example.com" or "https://example.com/" -> "https://example.com"; invalid -> "". */
function siteOrigin(raw: string | undefined): string {
  const v = raw?.trim();
  if (!v) return '';
  try { return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin; } catch { return ''; }
}

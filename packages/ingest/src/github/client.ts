import { config, log } from '../config';
import { Budget } from './budget';
import type { IngestState } from '../cache';

export interface GqlRelease {
  id: string; databaseId: number | null; tagName: string; name: string | null; isPrerelease: boolean; isDraft: boolean;
  publishedAt: string | null; createdAt: string; url: string; description: string | null;
}
export interface GqlTag { name: string; target: { oid: string; committedDate?: string | null; tagger?: { date: string } | null } }
export interface GqlRepo {
  nameWithOwner: string; isArchived: boolean; pushedAt: string;
  releases: { nodes: GqlRelease[] };
  refs?: { nodes: GqlTag[] };
}
export interface BatchResult { repos: Record<string, GqlRepo | null>; cost: number; remaining: number; resetAt: string; errors?: unknown[] }

const GQL = 'https://api.github.com/graphql';
const REST = 'https://api.github.com';

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': config.userAgent, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...extra };
  if (config.githubToken) h.Authorization = `Bearer ${config.githubToken}`;
  return h;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      const wait = 1000 * 2 ** i;
      log.warn(`${label} failed (attempt ${i + 1}/${attempts}): ${(e as Error).message}; retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * One GraphQL request fetches releases (and optionally tags) for up to N repos
 * using aliases. Cost formula (GitHub): roughly ceil(total_nodes / 100), where
 * total_nodes = repos * (1 + releases + tags). With 40 repos x (1 + 5) that is
 * ~240 nodes = 3 points. The `rateLimit` object is requested on every call so
 * the Budget sees the real cost, not an estimate.
 */
export async function fetchReleasesBatch(
  repos: Array<{ owner: string; name: string; releases: number; tags: number }>,
  budget: Budget,
): Promise<BatchResult> {
  const estimate = Math.ceil((repos.reduce((n, r) => n + 1 + r.releases + r.tags, 0)) / 100) + 1;
  if (!budget.canAffordGraphql(estimate)) throw new Error(`batch estimate ${estimate} does not fit remaining run budget`);

  const aliases = repos.map((r, i) => `r${i}: repository(owner: ${JSON.stringify(r.owner)}, name: ${JSON.stringify(r.name)}) {
      ...RepoFields
      releases(first: ${r.releases}, orderBy: {field: CREATED_AT, direction: DESC}) { nodes { ...ReleaseFields } }
      ${r.tags > 0 ? `refs(refPrefix: "refs/tags/", first: ${r.tags}, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) { nodes { name target { oid ... on Commit { committedDate } ... on Tag { tagger { date } } } } }` : ''}
    }`).join('\n');

  const query = `query StakestackReleases {
    rateLimit { cost remaining resetAt limit }
    ${aliases}
  }
  fragment RepoFields on Repository { nameWithOwner isArchived pushedAt }
  fragment ReleaseFields on Release { id databaseId tagName name isPrerelease isDraft publishedAt createdAt url description }`;

  const res = await withRetry(() => fetch(GQL, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ query }) }), 'graphql');
  if (res.status === 401) throw new Error('GitHub token rejected (401). Check GITHUB_TOKEN.');
  if (res.status === 403 || res.status === 429) {
    const retry = res.headers.get('retry-after');
    throw new Error(`GitHub rate limited (${res.status}); retry-after=${retry ?? 'n/a'}; remaining=${res.headers.get('x-ratelimit-remaining')}`);
  }
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json() as { data?: Record<string, unknown>; errors?: unknown[] };
  const data = json.data ?? {};
  const rl = data.rateLimit as { cost: number; remaining: number; resetAt: string } | undefined;
  if (!rl) throw new Error(`GraphQL response without rateLimit: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  budget.spendGraphql(rl.cost, rl.remaining, rl.resetAt);
  const out: Record<string, GqlRepo | null> = {};
  repos.forEach((r, i) => { out[`${r.owner}/${r.name}`] = (data[`r${i}`] as GqlRepo | null) ?? null; });
  if (json.errors?.length) log.warn('graphql partial errors', JSON.stringify(json.errors).slice(0, 800));
  return { repos: out, cost: rl.cost, remaining: rl.remaining, resetAt: rl.resetAt, errors: json.errors };
}

export interface RestAdvisory {
  ghsa_id: string; cve_id: string | null; summary: string; severity: string; html_url: string; published_at: string; updated_at: string; withdrawn_at: string | null;
}

/**
 * REST with ETag. A 304 costs nothing against the rate limit, so polling
 * advisories daily for ~80 repos is nearly free after the first run.
 */
export async function fetchAdvisories(owner: string, name: string, state: IngestState, budget: Budget): Promise<RestAdvisory[] | null> {
  const url = `${REST}/repos/${owner}/${name}/security-advisories?state=published&per_page=20&sort=updated&direction=desc`;
  const etag = state.etags[url];
  const res = await withRetry(() => fetch(url, { headers: headers(etag ? { 'If-None-Match': etag } : {}) }), `advisories ${owner}/${name}`);
  budget.spendRest(res.status, res.headers);
  if (res.status === 304) return null;              // unchanged
  if (res.status === 404) return [];                // advisories disabled / repo private
  if (!res.ok) { log.warn(`advisories ${owner}/${name}: HTTP ${res.status}`); return null; }
  const et = res.headers.get('etag'); if (et) state.etags[url] = et;
  return await res.json() as RestAdvisory[];
}

/** Used by CI catalog checks only: HEAD a repo to confirm it exists (follows renames). 1 REST call. */
export async function repoExists(owner: string, name: string, budget: Budget): Promise<boolean> {
  const res = await fetch(`${REST}/repos/${owner}/${name}`, { method: 'GET', headers: headers() });
  budget.spendRest(res.status, res.headers);
  return res.ok;
}

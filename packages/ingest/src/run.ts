import { loadCatalog } from '@stakestack/shared/catalog';
import { isStableTag } from '@stakestack/shared/versions';
import type { Component, Release } from '@stakestack/shared/types';
import { config, log } from './config';
import { loadState, saveState } from './cache';
import { Budget, BudgetExceeded } from './github/budget';
import { fetchReleasesBatch, fetchAdvisories, type GqlRepo } from './github/client';
import { assessRelease } from './assess/rules';
import { db, upsert } from './db';

/**
 * One ingest run:
 *   1. group catalog repos (several components can share a repo, e.g. erigon/caplin)
 *   2. GraphQL batches: releases (+tags for release_source: tags) for every repo
 *   3. diff against cache -> only new/changed releases get assessed + upserted
 *   4. advisories over REST with ETag, at most once per INGEST_ADVISORIES_INTERVAL_HOURS per repo
 *   5. persist state, write ingest_runs row, ping /api/revalidate
 * Budget ceilings are enforced inside the GitHub client; BudgetExceeded ends the run gracefully.
 */
async function main() {
  const started = Date.now();
  if (!config.githubToken) { log.error('GITHUB_TOKEN is required: the GraphQL API rejects anonymous requests. Create a fine-grained PAT (public repos, no permissions).'); process.exit(2); }
  const cat = loadCatalog();
  const state = loadState();
  const budget = new Budget();
  const client = config.dryRun ? null : db();

  // repo -> components
  const byRepo = new Map<string, Component[]>();
  for (const c of cat.components) { if (c.status === 'archived') continue; const k = c.repo.toLowerCase(); byRepo.set(k, [...(byRepo.get(k) ?? []), c]); }
  const repoList = [...byRepo.entries()].map(([key, comps]) => {
    const [owner, name] = comps[0]!.repo.split('/') as [string, string];
    const needsTags = comps.some(c => c.release_source === 'tags');
    const backfill = config.backfill || !state.seen[key]?.backfilled;
    return { key, owner, name, comps, releases: backfill ? config.backfillReleasesPerRepo : config.releasesPerRepo, tags: needsTags ? config.tagsPerRepo : 0 };
  });
  log.info(`repos: ${repoList.length} (${repoList.filter(r => r.releases > config.releasesPerRepo).length} backfilling)`);

  const newReleases: Release[] = [];
  const repoMeta: Record<string, { archived: boolean; pushed_at: string }> = {};
  let batchesDone = 0;
  try {
    for (let i = 0; i < repoList.length; i += config.reposPerBatch) {
      const batch = repoList.slice(i, i + config.reposPerBatch);
      const res = await fetchReleasesBatch(batch, budget);
      batchesDone += 1;
      log.info(`batch ${batchesDone}: ${batch.length} repos, cost ${res.cost}, remaining ${res.remaining}`);
      for (const r of batch) {
        const repo = res.repos[`${r.owner}/${r.name}`];
        if (!repo) { log.warn(`repo missing in response: ${r.owner}/${r.name}`); continue; }
        repoMeta[r.key] = { archived: repo.isArchived, pushed_at: repo.pushedAt };
        newReleases.push(...extractReleases(repo, r.comps, state.seen[r.key]?.newestPublishedAt ?? null, r.releases > config.releasesPerRepo));
        const newest = repo.releases.nodes.find(n => !n.isDraft);
        state.seen[r.key] = { newestNodeId: newest?.id ?? state.seen[r.key]?.newestNodeId ?? null, newestPublishedAt: maxDate(repo, state.seen[r.key]?.newestPublishedAt ?? null), backfilled: true };
      }
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) log.warn(`stopping releases early: ${e.message}`); else throw e;
  }

  // assess + write
  const assessments = newReleases.map(rel => {
    const comp = cat.components.find(c => c.slug === rel.component_slug)!;
    return assessRelease(rel, comp.assessor);
  });
  log.info(`new/changed releases: ${newReleases.length}`);
  for (const a of assessments.filter(a => a.severity === 'critical' || a.severity === 'high')) log.info(`  ${a.severity.toUpperCase()} ${a.component_slug} ${a.release_tag} [${a.flags.join(',')}]`);

  if (client && newReleases.length) {
    await upsert(client, 'releases', newReleases.map(r => ({
      component_slug: r.component_slug, repo: r.repo, tag: r.tag, name: r.name ?? null, url: r.url, body: r.body ?? null, is_prerelease: r.is_prerelease,
      is_draft: !!r.is_draft, published_at: r.published_at, github_node_id: r.github_node_id ?? null, github_database_id: r.github_database_id ?? null, source: r.source,
    })), 'component_slug,tag');
    await upsert(client, 'release_assessments', assessments.map(a => ({
      component_slug: a.component_slug, release_tag: a.release_tag, severity: a.severity, score: a.score, flags: a.flags, networks: a.networks ?? [], wave_id: a.wave ?? null,
      evidence: a.evidence, assessor: a.assessor, assessor_version: a.assessor_version, source: 'rules',
    })), 'component_slug,release_tag,source');
    await upsert(client, 'components', Object.entries(repoMeta).flatMap(([key, m]) => (byRepo.get(key) ?? []).map(c => ({ slug: c.slug, repo_archived: m.archived, repo_pushed_at: m.pushed_at }))), 'slug');
  }

  // advisories (REST + ETag)
  let advisoryRows = 0;
  try {
    const cutoff = Date.now() - config.advisoriesIntervalHours * 3600_000;
    for (const r of repoList) {
      const last = state.lastAdvisoryPoll[r.key];
      if (last && new Date(last).getTime() > cutoff) continue;
      const adv = await fetchAdvisories(r.owner, r.name, state, budget);
      state.lastAdvisoryPoll[r.key] = new Date().toISOString();
      if (!adv || adv.length === 0) continue;
      advisoryRows += adv.length;
      if (client) await upsert(client, 'advisories', adv.flatMap(a => r.comps.map(c => ({
        ghsa_id: a.ghsa_id, component_slug: c.slug, cve_id: a.cve_id, summary: a.summary, severity: a.severity, url: a.html_url, published_at: a.published_at, updated_at: a.updated_at, withdrawn_at: a.withdrawn_at,
      }))), 'ghsa_id,component_slug');
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) log.warn(`stopping advisories early: ${e.message}`); else throw e;
  }

  saveState(state);
  const report = budget.report();
  if (client) {
    const { error } = await client.from('ingest_runs').insert({
      started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(), repos: repoList.length, batches: batchesDone,
      new_releases: newReleases.length, advisories: advisoryRows, graphql_points: report.graphqlPoints, rest_requests: report.restRequests, rest_304: report.rest304,
      remaining_points: report.remainingPoints, remaining_rest: report.remainingRest, dry_run: false,
    });
    if (error) log.warn(`ingest_runs insert: ${error.message}`);
    if (newReleases.length && config.revalidateUrl && config.revalidateSecret) {
      await fetch(config.revalidateUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-revalidate-secret': config.revalidateSecret }, body: JSON.stringify({ components: [...new Set(newReleases.map(r => r.component_slug))] }) }).catch(e => log.warn(`revalidate: ${(e as Error).message}`));
    }
  }
  log.info(`done in ${Math.round((Date.now() - started) / 1000)}s`);
}

function maxDate(repo: GqlRepo, prev: string | null): string | null {
  const dates = repo.releases.nodes.map(n => n.publishedAt ?? n.createdAt).filter(Boolean) as string[];
  const m = dates.sort().at(-1) ?? null;
  return !prev || (m && m > prev) ? m : prev;
}

/** Convert GraphQL nodes into Release rows for each component sharing the repo. Only releases newer than
 *  (newestSeen - 7 days) are returned on normal polls so late edits to recent notes are re-assessed. */
function extractReleases(repo: GqlRepo, comps: Component[], newestSeen: string | null, backfill: boolean): Release[] {
  const floor = newestSeen && !backfill ? new Date(new Date(newestSeen).getTime() - 7 * 86400_000).toISOString() : null;
  const out: Release[] = [];
  for (const c of comps) {
    if ((c.release_source ?? 'releases') === 'releases') {
      for (const n of repo.releases.nodes) {
        if (n.isDraft) continue;
        const published = n.publishedAt ?? n.createdAt;
        if (floor && published < floor) continue;
        out.push({ component_slug: c.slug, repo: repo.nameWithOwner, tag: n.tagName, name: n.name, url: n.url, body: n.description, is_prerelease: n.isPrerelease || !isStableTag(n.tagName, c.stable_tag_pattern), is_draft: false, published_at: published, github_node_id: n.id, github_database_id: n.databaseId, source: 'releases' });
      }
    } else {
      for (const t of repo.refs?.nodes ?? []) {
        const date = t.target.tagger?.date ?? t.target.committedDate ?? repo.pushedAt;
        if (floor && date < floor) continue;
        out.push({ component_slug: c.slug, repo: repo.nameWithOwner, tag: t.name, name: t.name, url: `https://github.com/${repo.nameWithOwner}/releases/tag/${encodeURIComponent(t.name)}`, body: null, is_prerelease: !isStableTag(t.name, c.stable_tag_pattern), is_draft: false, published_at: date, github_node_id: null, github_database_id: null, source: 'tags' });
      }
    }
  }
  return out;
}

main().catch(e => { log.error(e); process.exit(1); });

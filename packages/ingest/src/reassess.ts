import { loadCatalog } from '@stakestack/shared/catalog';
import type { Release, Severity } from '@stakestack/shared/types';
import { config, log } from './config';
import { db, dbStats, upsert } from './db';
import { assessRelease, ASSESSOR_VERSION } from './assess/rules';

/**
 * Re-run the rule-based assessor over every release already in Supabase, without
 * calling GitHub. The normal ingest only re-assesses releases inside its 7-day
 * re-check window, so after changing the rules (and ASSESSOR_VERSION) run this once:
 *
 *   pnpm reassess -- --dry-run            # before -> after table and changed rows, no writes
 *   pnpm reassess                         # write release_assessments (source = 'rules')
 *   pnpm reassess -- --component=lighthouse --limit=50
 *
 * Only `source = 'rules'` rows are written; `llm` and `manual` overrides are untouched
 * and still win in release_assessment_effective.
 */
const SEVERITIES: Severity[] = ['critical', 'high', 'recommended', 'optional', 'unassessed'];
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];

async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return out;
  }
}

async function main() {
  const client = db();
  const only = arg('component');
  const limit = Number(arg('limit') ?? 40);
  const cat = loadCatalog();
  const comps = new Map(cat.components.map(c => [c.slug, c]));

  const releases = await all<Release>((a, b) => {
    let q = client.from('releases').select('component_slug,repo,tag,name,url,body,is_prerelease,published_at,source').eq('is_draft', false).order('id').range(a, b);
    if (only) q = q.eq('component_slug', only);
    return q;
  });
  type Old = { component_slug: string; release_tag: string; severity: Severity; flags: string[]; assessor_version: string };
  const previous = await all<Old>((a, b) => {
    let q = client.from('release_assessments').select('component_slug,release_tag,severity,flags,assessor_version').eq('source', 'rules').order('id').range(a, b);
    if (only) q = q.eq('component_slug', only);
    return q;
  });
  const prev = new Map(previous.map(p => [`${p.component_slug}@${p.release_tag}`, p]));

  const before: Record<string, number> = {}; const after: Record<string, number> = {};
  const rows: Record<string, unknown>[] = []; const changed: string[] = [];
  let skipped = 0;
  for (const r of releases) {
    const comp = comps.get(r.component_slug);
    if (!comp) { skipped += 1; continue; }
    const cap = comp.roles.some(x => x === 'spec' || x === 'network-config') ? 'high' : undefined;
    const a = assessRelease(r, comp.assessor, { capSeverity: cap });
    const old = prev.get(`${r.component_slug}@${r.tag}`);
    const oldSev = old?.severity ?? 'unassessed';
    before[oldSev] = (before[oldSev] ?? 0) + 1;
    after[a.severity] = (after[a.severity] ?? 0) + 1;
    const flagsChanged = !old || [...old.flags].sort().join() !== [...a.flags].sort().join();
    if (oldSev !== a.severity || flagsChanged) changed.push(`${r.component_slug}@${r.tag}: ${oldSev} -> ${a.severity} [${a.flags.join(',')}]${a.evidence[0] ? ` | ${a.evidence[0].text.slice(0, 110)}` : ''}`);
    if (!old || old.assessor_version !== ASSESSOR_VERSION || oldSev !== a.severity || flagsChanged) {
      rows.push({
        component_slug: a.component_slug, release_tag: a.release_tag, severity: a.severity, score: a.score, flags: a.flags, networks: a.networks ?? [], wave_id: a.wave ?? null,
        evidence: a.evidence, assessor: a.assessor, assessor_version: a.assessor_version, source: 'rules',
      });
    }
  }

  console.log(`assessor ${ASSESSOR_VERSION}: ${releases.length} releases${only ? ` of ${only}` : ''}${skipped ? `, ${skipped} skipped (component not in catalog)` : ''}`);
  console.table(Object.fromEntries(SEVERITIES.map(s => [s, { before: before[s] ?? 0, after: after[s] ?? 0 }])));
  console.log(`${changed.length} releases change severity or flags${changed.length > limit ? ` (first ${limit})` : ''}:`);
  for (const line of changed.slice(0, limit)) console.log(`  ${line}`);

  if (config.dryRun) { log.info(`dry run: ${rows.length} assessment rows would be written`); return; }
  await upsert(client, 'release_assessments', rows, 'component_slug,release_tag,source');
  log.info(`wrote ${rows.length} assessment rows`, { supabase: { ...dbStats } });
}

main().catch(e => { log.error(e); process.exit(1); });

import { loadCatalog, validateCatalog } from '@stakestack/shared/catalog';
import { config, log } from './config';
import { db, upsert } from './db';

/** Upsert the YAML catalog into Supabase. Idempotent; run on every push to main. */
async function main() {
  const issues = validateCatalog();
  if (issues.length) { for (const i of issues) log.error(`${i.file} ${i.path}: ${i.message}`); process.exit(1); }
  const cat = loadCatalog();
  log.info(`catalog: ${cat.components.length} components, ${cat.upgrades.length} upgrades`);
  if (config.dryRun) { log.info('dry run; not writing'); return; }
  const client = db();
  await upsert(client, 'networks', cat.networks.map(n => ({ id: n.id, name: n.name, kind: n.kind, chain_id: n.chain_id ?? null, config_repo: n.config_repo ?? null, rollout_order: n.rollout_order, deprecated: !!n.deprecated, description: n.description ?? null })), 'id');
  await upsert(client, 'fork_waves', cat.waves.map(w => ({ id: w.id, name: w.name, status: w.status, meta_eip: w.meta_eip ?? null })), 'id');
  await upsert(client, 'components', cat.components.map(c => ({
    slug: c.slug, name: c.name, vendor: c.vendor ?? null, summary: c.summary ?? null, roles: c.roles, repo: c.repo,
    release_source: c.release_source ?? 'releases', stable_tag_pattern: c.stable_tag_pattern ?? null, homepage: c.homepage ?? null, docs: c.docs ?? null,
    docker_image: c.docker_image ?? null, language: c.language ?? null, license: c.license ?? null, networks: c.networks ?? null, status: c.status,
    assessor: c.assessor, embeds: c.embeds ?? null, supports: c.supports ?? {}, tags: c.tags ?? [], priority_weight: c.priority_weight ?? 1, notes: c.notes ?? null,
  })), 'slug');
  await upsert(client, 'slots', cat.slots.map(s => ({ id: s.id, label: s.label, description: s.description ?? null, role: s.role, cardinality: s.cardinality, required: s.required, hidden_by_default: !!s.hidden_by_default, sort_order: s.order ?? 0, include_tag: s.include_tag ?? null, exclude_tag: s.exclude_tag ?? null })), 'id');
  const ruleRows = cat.rules.map(r => ({ id: r.id, description: r.description ?? null, when_clause: r.when, then_clause: r.then, sources: r.sources ?? [], verified_at: r.verified_at ?? null }));
  try {
    await upsert(client, 'composition_rules', ruleRows, 'id');
  } catch (e) {
    // Database without migration 0006: keep syncing the rules themselves, without their sources.
    if (!/sources|verified_at/.test((e as Error).message)) throw e;
    log.warn('composition_rules has no sources/verified_at columns; apply supabase/migrations/0006_rule_sources.sql. Syncing rules without sources.');
    await upsert(client, 'composition_rules', ruleRows.map(({ sources: _s, verified_at: _v, ...r }) => r), 'id');
  }
  // Rules deleted from YAML must not linger in the database.
  const ruleIds = cat.rules.map(r => r.id);
  const { error: delErr } = await client.from('composition_rules').delete().not('id', 'in', `(${ruleIds.map(id => `"${id}"`).join(',')})`);
  if (delErr) throw new Error(`prune composition_rules: ${delErr.message}`);
  // Upgrades: never overwrite human-confirmed rows from YAML drafts with less information.
  await upsert(client, 'network_upgrades', cat.upgrades.map(u => ({
    id: u.id, wave_id: u.wave, network_id: u.network, status: u.status, activation_epoch: u.activation_epoch ?? null, activation_time: u.activation_time ?? null,
    announcement_url: u.announcement ?? null, verified: !!u.verified, tentative: !!u.tentative, required_versions: u.required_versions ?? {}, notes: u.notes ?? null, source: 'catalog',
  })), 'id');
  await upsert(client, 'catalog_meta', [{ id: 'rollout_sequence', value: cat.rollout_sequence }], 'id');
  log.info('catalog synced');
}
main().catch(e => { log.error(e); process.exit(1); });

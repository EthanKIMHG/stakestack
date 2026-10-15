import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { Catalog, Component, NetworksFile, SlotsFile } from './types';

export interface CatalogIssue { file: string; path: string; message: string }

export function defaultCatalogDir(): string {
  return process.env.CATALOG_DIR ? resolve(process.env.CATALOG_DIR) : resolve(process.cwd(), '../../catalog');
}

function readYaml<T>(file: string): T {
  return YAML.parse(readFileSync(file, 'utf8')) as T;
}

export function loadCatalog(dir = defaultCatalogDir()): Catalog {
  const componentsDir = join(dir, 'components');
  const files = readdirSync(componentsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  const components: Component[] = files.flatMap(f => readYaml<Component[]>(join(componentsDir, f)) ?? []);
  const slots = readYaml<SlotsFile>(join(dir, 'slots.yaml'));
  const nets = readYaml<NetworksFile>(join(dir, 'networks.yaml'));
  return {
    components,
    slots: slots.slots,
    rules: slots.rules,
    networks: nets.networks,
    rollout_sequence: nets.rollout_sequence,
    waves: nets.waves,
    upgrades: nets.upgrades,
  };
}

/** Schema + referential validation. Returns [] when the catalog is valid. */
export function validateCatalog(dir = defaultCatalogDir()): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const componentSchema = JSON.parse(readFileSync(join(dir, 'schema/component.schema.json'), 'utf8'));
  const slotsSchema = JSON.parse(readFileSync(join(dir, 'schema/slots.schema.json'), 'utf8'));
  const validateComponents = ajv.compile(componentSchema);
  const validateSlots = ajv.compile(slotsSchema);

  const componentsDir = join(dir, 'components');
  const seen = new Map<string, string>();
  const all: Component[] = [];
  for (const f of readdirSync(componentsDir).filter(x => x.endsWith('.yaml')).sort()) {
    const data = readYaml<Component[]>(join(componentsDir, f));
    if (!validateComponents(data)) {
      for (const e of validateComponents.errors ?? []) issues.push({ file: `components/${f}`, path: e.instancePath, message: e.message ?? 'invalid' });
      continue;
    }
    for (const c of data) {
      if (seen.has(c.slug)) issues.push({ file: `components/${f}`, path: c.slug, message: `duplicate slug (also in ${seen.get(c.slug)})` });
      seen.set(c.slug, f);
      if (c.stable_tag_pattern) {
        try { new RegExp(c.stable_tag_pattern); } catch { issues.push({ file: `components/${f}`, path: `${c.slug}.stable_tag_pattern`, message: 'invalid regex' }); }
      }
      all.push(c);
    }
  }

  const slotsFile = readYaml<SlotsFile>(join(dir, 'slots.yaml'));
  if (!validateSlots(slotsFile)) {
    for (const e of validateSlots.errors ?? []) issues.push({ file: 'slots.yaml', path: e.instancePath, message: e.message ?? 'invalid' });
  } else {
    const slotIds = new Set(slotsFile.slots.map(s => s.id));
    const slugs = new Set(all.map(c => c.slug));
    const ref = (file: string, path: string, slug: string) => { if (!slugs.has(slug)) issues.push({ file, path, message: `unknown component slug "${slug}"` }); };
    for (const r of slotsFile.rules) {
      if (r.when.component) ref('slots.yaml', `${r.id}.when.component`, r.when.component);
      for (const s of r.when.any_of ?? []) ref('slots.yaml', `${r.id}.when.any_of`, s);
      for (const s of r.when.all_of ?? []) ref('slots.yaml', `${r.id}.when.all_of`, s);
      for (const s of [...(r.then.recommend ?? []), ...(r.then.require ?? []), ...(r.then.conflict ?? [])]) ref('slots.yaml', `${r.id}.then`, s);
      for (const s of [...(r.then.open_slots ?? []), ...(r.then.hide_slots ?? []), ...(r.then.require_slots ?? [])]) if (!slotIds.has(s)) issues.push({ file: 'slots.yaml', path: `${r.id}.then`, message: `unknown slot "${s}"` });
      for (const rs of r.then.restrict ?? []) { if (!slotIds.has(rs.slot)) issues.push({ file: 'slots.yaml', path: `${r.id}.then.restrict`, message: `unknown slot "${rs.slot}"` }); for (const s of rs.to ?? []) ref('slots.yaml', `${r.id}.then.restrict.to`, s); }
    }
  }

  const nets = readYaml<NetworksFile>(join(dir, 'networks.yaml'));
  const netIds = new Set(nets.networks.map(n => n.id));
  const waveIds = new Set(nets.waves.map(w => w.id));
  const slugs = new Set(all.map(c => c.slug));
  for (const n of nets.rollout_sequence) if (!netIds.has(n)) issues.push({ file: 'networks.yaml', path: 'rollout_sequence', message: `unknown network "${n}"` });
  const upIds = new Set<string>();
  for (const u of nets.upgrades) {
    if (upIds.has(u.id)) issues.push({ file: 'networks.yaml', path: u.id, message: 'duplicate upgrade id' });
    upIds.add(u.id);
    if (!netIds.has(u.network)) issues.push({ file: 'networks.yaml', path: `${u.id}.network`, message: `unknown network "${u.network}"` });
    if (!waveIds.has(u.wave)) issues.push({ file: 'networks.yaml', path: `${u.id}.wave`, message: `unknown wave "${u.wave}"` });
    for (const slug of Object.keys(u.required_versions ?? {})) if (!slugs.has(slug)) issues.push({ file: 'networks.yaml', path: `${u.id}.required_versions`, message: `unknown component slug "${slug}"` });
    if (u.status === 'activated' && !u.activation_time) issues.push({ file: 'networks.yaml', path: `${u.id}`, message: 'activated upgrade needs activation_time' });
  }
  for (const c of all) for (const n of c.networks ?? []) if (!netIds.has(n)) issues.push({ file: 'components', path: `${c.slug}.networks`, message: `unknown network "${n}"` });
  return issues;
}

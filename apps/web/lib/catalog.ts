import 'server-only';
import { cache } from 'react';
import { resolve } from 'node:path';
import type { Catalog, Component, Network, Release, Rule, Slot, Upgrade, Wave, Stack } from '@stakestack/shared/types';
import { supabase } from './supabase';
import { withLogos } from './logos';

/**
 * Catalog from Supabase; falls back to the YAML files in ../../catalog when the
 * database is not configured (local dev, CI build). Releases always come from
 * Supabase and are empty in fallback mode.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  const sb = supabase();
  if (sb) {
    const [c, s, r, n, w, u, m] = await Promise.all([
      sb.from('components').select('*'), sb.from('slots').select('*').order('sort_order'), sb.from('composition_rules').select('*'),
      sb.from('networks').select('*').order('rollout_order'), sb.from('fork_waves').select('*'), sb.from('network_upgrades').select('*'), sb.from('catalog_meta').select('*').eq('id', 'rollout_sequence').maybeSingle(),
    ]);
    if (!c.error && (c.data?.length ?? 0) > 0) {
      return withLogos({
        components: (c.data ?? []) as Component[],
        slots: (s.data ?? []).map(x => ({ id: x.id, label: x.label, description: x.description ?? undefined, role: x.role, cardinality: x.cardinality, required: x.required, hidden_by_default: x.hidden_by_default, order: x.sort_order, include_tag: x.include_tag ?? undefined, exclude_tag: x.exclude_tag ?? undefined })) as Slot[],
        rules: (r.data ?? []).map(x => ({ id: x.id, description: x.description ?? undefined, when: x.when_clause, then: x.then_clause, sources: x.sources ?? undefined, verified_at: x.verified_at ?? undefined })) as Rule[],
        networks: (n.data ?? []) as Network[],
        rollout_sequence: (m.data?.value as string[] | undefined) ?? ['sepolia', 'hoodi', 'mainnet'],
        waves: (w.data ?? []) as Wave[],
        upgrades: (u.data ?? []).map(x => ({ id: x.id, wave: x.wave_id, network: x.network_id, status: x.status, activation_epoch: x.activation_epoch, activation_time: x.activation_time, announcement: x.announcement_url, verified: x.verified, tentative: x.tentative ?? false, required_versions: x.required_versions ?? {}, notes: x.notes ?? undefined })) as Upgrade[],
      });
    }
  }
  const { loadCatalog } = await import('@stakestack/shared/catalog');
  return withLogos(loadCatalog(resolve(process.cwd(), '../../catalog')));
});

export async function getReleases(componentSlugs: string[], limit = 200): Promise<Release[]> {
  const sb = supabase();
  if (!sb || componentSlugs.length === 0) return [];
  const { data } = await sb.from('releases').select('*').in('component_slug', componentSlugs).eq('is_draft', false).order('published_at', { ascending: false }).limit(Math.max(limit, componentSlugs.length * 30));
  return (data ?? []) as Release[];
}

export type { TimelineRow } from './types';
import type { TimelineRow } from './types';
export async function getTimeline(selection: Stack['selection'], limit = 100): Promise<TimelineRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('stack_timeline', { p_selection: selection, p_limit: limit });
  if (error) { console.error('stack_timeline', error.message); return []; }
  return (data ?? []) as TimelineRow[];
}

export async function getLatestAssessed(limit = 30): Promise<TimelineRow[]> {
  const sb = supabase();
  if (!sb) return [];
  // Stable releases of software operators actually run (priority_weight >= 1), rated recommended or higher.
  const { data, error } = await sb.from('latest_assessed').select('*')
    .in('severity', ['critical', 'high', 'recommended']).eq('is_prerelease', false).gte('priority_weight', 1)
    .order('published_at', { ascending: false }).limit(limit);
  if (error) { console.error('latest_assessed', error.message); return []; }
  return (data ?? []) as TimelineRow[];
}

/** All recent releases (any severity, incl. pre-releases) for the Releases page. */
export async function getLatestAssessedAll(limit = 250): Promise<TimelineRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from('latest_assessed').select('*').order('published_at', { ascending: false }).limit(limit);
  if (error) { console.error('latest_assessed', error.message); return []; }
  return (data ?? []) as TimelineRow[];
}

export async function getStack(slug: string): Promise<Stack | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from('stacks').select('*').eq('slug', slug).maybeSingle();
  if (!data) return null;
  return { ...(data as Stack), topology: (data as { topology?: Stack['topology'] }).topology ?? null };
}

/** The wave operators should be looking at: the first one not fully activated, else the newest. */
export function currentWave(catalog: Catalog): Catalog['waves'][number] | null {
  const order = catalog.waves.map(w => w.id);
  const active = catalog.waves.find(w => w.status === 'in_progress');
  if (active) return active;
  return catalog.waves.filter(w => w.status === 'completed').sort((a, b) => order.indexOf(b.id) - order.indexOf(a.id))[0] ?? null;
}

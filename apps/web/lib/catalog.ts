import 'server-only';
import { cache } from 'react';
import { resolve } from 'node:path';
import type { Catalog, Component, Network, Release, Rule, Slot, Upgrade, Wave, Stack } from '@stakestack/shared/types';
import { supabase } from './supabase';

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
      return {
        components: (c.data ?? []) as Component[],
        slots: (s.data ?? []).map(x => ({ id: x.id, label: x.label, description: x.description ?? undefined, role: x.role, cardinality: x.cardinality, required: x.required, hidden_by_default: x.hidden_by_default, order: x.sort_order })) as Slot[],
        rules: (r.data ?? []).map(x => ({ id: x.id, description: x.description ?? undefined, when: x.when_clause, then: x.then_clause })) as Rule[],
        networks: (n.data ?? []) as Network[],
        rollout_sequence: (m.data?.value as string[] | undefined) ?? ['sepolia', 'hoodi', 'mainnet'],
        waves: (w.data ?? []) as Wave[],
        upgrades: (u.data ?? []).map(x => ({ id: x.id, wave: x.wave_id, network: x.network_id, status: x.status, activation_epoch: x.activation_epoch, activation_time: x.activation_time, announcement: x.announcement_url, verified: x.verified, required_versions: x.required_versions ?? {}, notes: x.notes ?? undefined })) as Upgrade[],
      };
    }
  }
  const { loadCatalog } = await import('@stakestack/shared/catalog');
  return loadCatalog(resolve(process.cwd(), '../../catalog'));
});

export async function getReleases(componentSlugs: string[], limit = 200): Promise<Release[]> {
  const sb = supabase();
  if (!sb || componentSlugs.length === 0) return [];
  const { data } = await sb.from('releases').select('*').in('component_slug', componentSlugs).eq('is_draft', false).order('published_at', { ascending: false }).limit(limit);
  return (data ?? []) as Release[];
}

export interface TimelineRow {
  component_slug: string; component_name: string; tag: string; name: string | null; url: string; is_prerelease: boolean; published_at: string;
  severity: string; score: number; flags: string[]; networks: string[]; wave_id: string | null; evidence: Array<{ kind: string; text: string; weight: number }>; weighted_score: number;
}
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
  const { data } = await sb.from('release_assessment_effective').select('component_slug, release_tag, severity, score, flags, networks, wave_id, evidence, releases!inner(name,url,is_prerelease,published_at), components!inner(name)')
    .in('severity', ['critical', 'high', 'recommended']).order('created_at', { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(x => {
    const rel = x.releases as { name: string | null; url: string; is_prerelease: boolean; published_at: string };
    const comp = x.components as { name: string };
    return { component_slug: x.component_slug as string, component_name: comp.name, tag: x.release_tag as string, name: rel.name, url: rel.url, is_prerelease: rel.is_prerelease, published_at: rel.published_at, severity: x.severity as string, score: x.score as number, flags: x.flags as string[], networks: x.networks as string[], wave_id: x.wave_id as string | null, evidence: x.evidence as TimelineRow['evidence'], weighted_score: x.score as number };
  });
}

export async function getStack(slug: string): Promise<Stack | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from('stacks').select('*').eq('slug', slug).maybeSingle();
  return (data as Stack | null) ?? null;
}

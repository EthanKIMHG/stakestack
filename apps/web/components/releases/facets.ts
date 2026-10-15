import {
  Activity, Archive, BadgeCheck, CircleDashed, Cpu, FileKey, Flame, FlaskConical, Gauge, GitFork, Globe, KeyRound, Layers,
  LayoutDashboard, Network, Puzzle, ScrollText, Server, ShieldAlert, Siren, TriangleAlert, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { TimelineRow } from '@/lib/types';

/**
 * Facets for the release browser. Within one facet the chosen values are OR-ed, across facets they
 * are AND-ed, which is what operators expect from "critical or high, security, on mainnet".
 */
export type FacetKey = 'sev' | 'type' | 'cat' | 'net' | 'fork';

export interface FacetValue { id: string; label: string; icon?: LucideIcon }

export const SEVERITIES: FacetValue[] = [
  { id: 'critical', label: 'Critical' }, { id: 'high', label: 'High' }, { id: 'recommended', label: 'Recommended' },
  { id: 'optional', label: 'Optional' }, { id: 'unassessed', label: 'Unrated' },
];
export const SEV_RANK: Record<string, number> = { critical: 4, high: 3, recommended: 2, optional: 1, unassessed: 0 };

/** Assessment flags, plus "routine" for releases that carry none. `prerelease` is the channel switch instead. */
export const TYPES: FacetValue[] = [
  { id: 'security', label: 'Security', icon: ShieldAlert },
  { id: 'hardfork', label: 'Hard fork', icon: GitFork },
  { id: 'mandatory', label: 'Mandatory', icon: Siren },
  { id: 'breaking', label: 'Breaking', icon: TriangleAlert },
  { id: 'hotfix', label: 'Hotfix', icon: Flame },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'deprecation', label: 'Deprecation', icon: Archive },
  { id: 'testnet-only', label: 'Testnet only', icon: FlaskConical },
  { id: 'routine', label: 'Routine', icon: CircleDashed },
];

/** Component roles, in the order operators think about a stack. */
export const CATEGORIES: FacetValue[] = [
  { id: 'execution', label: 'Execution', icon: Cpu }, { id: 'consensus', label: 'Consensus', icon: Layers },
  { id: 'validator', label: 'Validator', icon: BadgeCheck }, { id: 'dvt', label: 'DVT', icon: Network },
  { id: 'mev', label: 'MEV', icon: Zap }, { id: 'remote-signer', label: 'Signer', icon: KeyRound },
  { id: 'protocol', label: 'Protocol', icon: Puzzle }, { id: 'node-manager', label: 'Node manager', icon: Wrench },
  { id: 'monitoring', label: 'Monitoring', icon: Activity }, { id: 'ui', label: 'Dashboards', icon: LayoutDashboard },
  { id: 'key-tooling', label: 'Keys', icon: FileKey }, { id: 'spec', label: 'Specs', icon: ScrollText },
  { id: 'network-config', label: 'Network configs', icon: Globe }, { id: 'infra', label: 'Infra', icon: Server },
];

export const NETWORKS: FacetValue[] = [
  { id: 'mainnet', label: 'Mainnet' }, { id: 'hoodi', label: 'Hoodi' }, { id: 'sepolia', label: 'Sepolia' },
  { id: 'holesky', label: 'Holesky' }, { id: 'ephemery', label: 'Ephemery' },
];

export const FACET_LABEL: Record<FacetKey, string> = { sev: 'Severity', type: 'Type', cat: 'Component', net: 'Network', fork: 'Fork' };

export type Channel = 'all' | 'stable' | 'pre';
export type Range = 'all' | '7d' | '30d' | '90d';
export type Sort = 'new' | 'sev';
export interface Filters { sev: string[]; type: string[]; cat: string[]; net: string[]; fork: string[]; q: string; ch: Channel; range: Range; sort: Sort }
export const EMPTY: Filters = { sev: [], type: [], cat: [], net: [], fork: [], q: '', ch: 'all', range: 'all', sort: 'new' };

const DAY = 86_400_000;
const RANGE_DAYS: Record<Range, number> = { all: 0, '7d': 7, '30d': 30, '90d': 90 };

/** The values one row contributes to each facet. */
export function rowValues(r: TimelineRow, roles: Record<string, string[]>): Record<FacetKey, string[]> {
  const flags = r.flags.filter(f => f !== 'prerelease');
  return {
    sev: [r.severity],
    type: flags.length ? flags : ['routine'],
    cat: roles[r.component_slug] ?? [],
    net: r.networks,
    fork: r.wave_id ? [r.wave_id] : [],
  };
}

export function matches(r: TimelineRow, v: Record<FacetKey, string[]>, f: Filters, now: number, skip?: FacetKey): boolean {
  for (const k of ['sev', 'type', 'cat', 'net', 'fork'] as FacetKey[]) {
    if (k === skip || f[k].length === 0) continue;
    if (!v[k].some(x => f[k].includes(x))) return false;
  }
  if (f.ch === 'stable' && r.is_prerelease) return false;
  if (f.ch === 'pre' && !r.is_prerelease) return false;
  if (f.range !== 'all' && now - new Date(r.published_at).getTime() > RANGE_DAYS[f.range] * DAY) return false;
  if (f.q) {
    const hay = `${r.component_name} ${r.component_slug} ${r.tag} ${r.name ?? ''}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t))) return false;
  }
  return true;
}

// ------------------------------------------------------------------ URL --
const LIST_KEYS: FacetKey[] = ['sev', 'type', 'cat', 'net', 'fork'];

export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  for (const k of LIST_KEYS) if (f[k].length) p.set(k, f[k].join(','));
  if (f.q) p.set('q', f.q);
  if (f.ch !== 'all') p.set('ch', f.ch);
  if (f.range !== 'all') p.set('range', f.range);
  if (f.sort !== 'new') p.set('sort', f.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function fromQuery(search: string): Filters {
  const p = new URLSearchParams(search);
  const list = (k: string) => (p.get(k) ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T => (allowed as readonly string[]).includes(p.get(k) ?? '') ? (p.get(k) as T) : d;
  return {
    sev: list('sev'), type: list('type'), cat: list('cat'), net: list('net'), fork: list('fork'), q: p.get('q') ?? '',
    ch: pick('ch', ['all', 'stable', 'pre'] as const, 'all'),
    range: pick('range', ['all', '7d', '30d', '90d'] as const, 'all'),
    sort: pick('sort', ['new', 'sev'] as const, 'new'),
  };
}

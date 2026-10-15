'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ChevronRight, Clock3, Inbox, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { useMyStacks } from './auth/myStacks';
import type { ComponentLogo } from '@stakestack/shared/types';
import type { TimelineRow } from '@/lib/types';
import { fmtDate, waveName } from '@/lib/format';
import { flagTone, NetDot } from './ui';
import { Logo } from './Logo';
import {
  CATEGORIES, EMPTY, FACET_LABEL, NETWORKS, SEVERITIES, SEV_RANK, TYPES, fromQuery, matches, rowValues, toQuery,
  type FacetKey, type FacetValue, type Filters,
} from './releases/facets';

const TYPE_META = new Map(TYPES.map(t => [t.id, t]));
const SEV_LABEL = new Map(SEVERITIES.map(s => [s.id, s.label]));

/**
 * Release browser: facet chips (severity, type, component, network, fork), a stable/pre-release
 * switch, date range, search and sort. Badges on each row toggle the same filters, so clicking
 * "security" on one release narrows the list to security releases. With `syncUrl` the filters live
 * in the query string and a filtered view can be shared.
 */
export function ReleaseList({ rows: allRows, logos = {}, roles = {}, facets = ['sev', 'type'], layout = 'inline', search, syncUrl = false, linkComponents = true, emptyText, pageSize = 50, personalize = false }: {
  rows: TimelineRow[];
  logos?: Record<string, ComponentLogo>;
  /** component slug -> roles, for the component facet */
  roles?: Record<string, string[]>;
  facets?: FacetKey[];
  layout?: 'sidebar' | 'inline';
  search?: boolean;
  syncUrl?: boolean;
  linkComponents?: boolean;
  emptyText?: string;
  pageSize?: number;
  /** Members see releases for the tools in their saved stacks first (a "My tools" scope). */
  personalize?: boolean;
}) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [ready, setReady] = useState(false);
  const [limit, setLimit] = useState(pageSize);
  const [panelOpen, setPanelOpen] = useState(false);
  const showSearch = search ?? layout === 'sidebar';

  // "My tools": components from the member's saved stacks. On by default once they load; the member can switch to all.
  const mine = useMyStacks();
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);
  const hasMine = personalize && mine.signedIn && mine.tools.size > 0;
  const effScope = hasMine ? (scope ?? 'mine') : 'all';
  const mineCount = useMemo(() => (hasMine ? allRows.filter(r => mine.tools.has(r.component_slug)).length : 0), [hasMine, allRows, mine.tools]);
  const rows = useMemo(() => (effScope === 'mine' ? allRows.filter(r => mine.tools.has(r.component_slug)) : allRows), [effScope, allRows, mine.tools]);

  // URL -> filters once, then filters -> URL. `ready` keeps the first write from wiping the query.
  useEffect(() => { if (syncUrl) setF(fromQuery(window.location.search)); setReady(true); }, [syncUrl]);
  useEffect(() => {
    if (!syncUrl || !ready) return;
    window.history.replaceState(null, '', `${window.location.pathname}${toQuery(f)}${window.location.hash}`);
  }, [f, ready, syncUrl]);

  const vals = useMemo(() => rows.map(r => rowValues(r, roles)), [rows, roles]);
  const now = useMemo(() => Date.now(), [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const out = rows.filter((r, i) => matches(r, vals[i]!, f, now));
    if (f.sort === 'sev') out.sort((a, b) => SEV_RANK[b.severity]! - SEV_RANK[a.severity]! || b.weighted_score - a.weighted_score || b.published_at.localeCompare(a.published_at));
    return out;
  }, [rows, vals, f, now]);

  /** Counts per facet value under every other active filter, so a chip shows what clicking it yields. */
  const counts = useMemo(() => {
    const out = {} as Record<FacetKey, Record<string, number>>;
    for (const k of facets) {
      const m: Record<string, number> = {};
      rows.forEach((r, i) => { if (matches(r, vals[i]!, f, now, k)) for (const v of vals[i]![k]) m[v] = (m[v] ?? 0) + 1; });
      out[k] = m;
    }
    return out;
  }, [rows, vals, f, facets, now]);

  /** Values that exist anywhere in this list; others are not worth a chip. */
  const present = useMemo(() => {
    const out = {} as Record<FacetKey, Set<string>>;
    for (const k of ['sev', 'type', 'cat', 'net', 'fork'] as FacetKey[]) out[k] = new Set(vals.flatMap(v => v[k]));
    return out;
  }, [vals]);

  const options: Record<FacetKey, FacetValue[]> = useMemo(() => {
    const known = (list: FacetValue[], k: FacetKey) => [...list.filter(v => present[k].has(v.id)), ...[...present[k]].filter(id => !list.some(v => v.id === id)).map(id => ({ id, label: waveName(id) }))];
    const newest = (id: string) => rows.find(r => r.wave_id === id)?.published_at ?? '';
    return {
      sev: SEVERITIES.filter(v => present.sev.has(v.id)),
      type: known(TYPES, 'type'),
      cat: known(CATEGORIES, 'cat'),
      net: known(NETWORKS, 'net'),
      fork: [...present.fork].sort((a, b) => newest(b).localeCompare(newest(a))).map(id => ({ id, label: waveName(id) })),
    };
  }, [present, rows]);

  const set = (patch: Partial<Filters>) => { setF(prev => ({ ...prev, ...patch })); setLimit(pageSize); };
  const toggle = (k: FacetKey, v: string) => {
    setF(prev => ({ ...prev, [k]: prev[k].includes(v) ? prev[k].filter(x => x !== v) : [...prev[k], v] }));
    setLimit(pageSize);
  };
  const active = facets.flatMap(k => f[k].map(v => ({ k, v })));
  const activeCount = active.length + (f.q ? 1 : 0) + (f.ch !== 'all' ? 1 : 0) + (f.range !== 'all' ? 1 : 0);
  const clear = () => set({ ...EMPTY, sort: f.sort });
  const label = (k: FacetKey, v: string) => options[k].find(o => o.id === v)?.label ?? v;
  const can = (k: FacetKey) => facets.includes(k);

  const groups = facets.filter(k => options[k].length > 0).map(k => (
    <div key={k} className="facet" role="group" aria-label={FACET_LABEL[k]}>
      <div className="facet-label">{FACET_LABEL[k]}</div>
      <div className="facet-chips">
        {options[k].map(o => {
          const on = f[k].includes(o.id);
          const n = counts[k]?.[o.id] ?? 0;
          const Icon = o.icon;
          return (
            <button key={o.id} type="button" className="fchip" aria-pressed={on} disabled={!on && n === 0} onClick={() => toggle(k, o.id)}>
              {k === 'sev' && <span className={`fdot sev-${o.id}`} aria-hidden />}
              {k === 'net' && <NetDot id={o.id} />}
              {Icon && <Icon aria-hidden />}
              {o.label}<span className="fcount">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  ));

  const channel = (
    <div className="seg" role="group" aria-label="Release channel">
      {(['all', 'stable', 'pre'] as const).map(c => <button key={c} type="button" aria-pressed={f.ch === c} onClick={() => set({ ch: c })}>{c === 'all' ? 'All' : c === 'stable' ? 'Stable' : 'Pre-release'}</button>)}
    </div>
  );
  const searchBox = showSearch && (
    <label className="search">
      <Search aria-hidden />
      <input className="field field-sm" placeholder="Search component or tag" value={f.q} onChange={e => set({ q: e.target.value })} aria-label="Search releases" />
    </label>
  );
  const sort = (
    <div className="seg" role="group" aria-label="Sort">
      <button type="button" aria-pressed={f.sort === 'new'} onClick={() => set({ sort: 'new' })}><Clock3 aria-hidden />Newest</button>
      <button type="button" aria-pressed={f.sort === 'sev'} onClick={() => set({ sort: 'sev' })}><ArrowDownWideNarrow aria-hidden />Severity</button>
    </div>
  );

  const head = (
    <div className="rel-head">
      {hasMine && (
        <div className="seg scope-seg" role="group" aria-label="Whose tools">
          <button type="button" aria-pressed={effScope === 'mine'} onClick={() => { setScope('mine'); setLimit(pageSize); }}><UserRound aria-hidden />My tools <span className="count">{mineCount}</span></button>
          <button type="button" aria-pressed={effScope === 'all'} onClick={() => { setScope('all'); setLimit(pageSize); }}>All tools <span className="count">{allRows.length}</span></button>
        </div>
      )}
      <div className="rel-head-top">
        <b className="rel-count">{filtered.length === rows.length ? `${rows.length} releases` : `${filtered.length} of ${rows.length}`}</b>
        {layout === 'sidebar' && (
          <button type="button" className="btn btn-sm filters-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen(o => !o)}>
            <SlidersHorizontal aria-hidden />Filters{activeCount > 0 && <span className="tab-count">{activeCount}</span>}
          </button>
        )}
        <div style={{ marginLeft: 'auto' }}>{sort}</div>
      </div>
      {activeCount > 0 && (
        <div className="active-bar">
          {active.map(({ k, v }) => <ActiveChip key={`${k}:${v}`} onRemove={() => toggle(k, v)}>{k === 'sev' && <span className={`fdot sev-${v}`} aria-hidden />}{label(k, v)}</ActiveChip>)}
          {f.ch !== 'all' && <ActiveChip onRemove={() => set({ ch: 'all' })}>{f.ch === 'stable' ? 'Stable' : 'Pre-release'}</ActiveChip>}
          {f.range !== 'all' && <ActiveChip onRemove={() => set({ range: 'all' })}>Last {f.range.replace('d', ' days')}</ActiveChip>}
          {f.q && <ActiveChip onRemove={() => set({ q: '' })}>“{f.q}”</ActiveChip>}
          <button type="button" className="btn btn-xs btn-quiet" onClick={clear}>Clear all</button>
        </div>
      )}
    </div>
  );

  const list = filtered.length === 0 ? (
    <div className="empty">
      <Inbox aria-hidden />{rows.length === 0 ? (effScope === 'mine' ? 'No recent releases for the tools in your stacks.' : (emptyText ?? 'No releases yet.')) : 'No releases match these filters.'}
      {activeCount > 0 && <button type="button" className="btn btn-sm" onClick={clear}>Clear filters</button>}
    </div>
  ) : (
    <div>
      {filtered.slice(0, limit).map(r => (
        <div key={`${r.component_slug}@${r.tag}`} className="rel-row">
          <div className="sev-cell">
            <Badge on={f.sev.includes(r.severity)} enabled={can('sev')} onClick={() => toggle('sev', r.severity)} className={`sev sev-${r.severity}`} title={`Show ${SEV_LABEL.get(r.severity) ?? r.severity} only`}>
              {r.severity === 'unassessed' ? 'unrated' : r.severity}
            </Badge>
          </div>
          <div className="rel-main">
            {linkComponents && <Logo logo={logos[r.component_slug]} name={r.component_name} size={28} />}
            <div style={{ minWidth: 0 }}>
              <div className="rel-title">
                {linkComponents ? <a href={`/c/${r.component_slug}`} className="rel-comp">{r.component_name}</a> : <span className="rel-comp">{r.component_name}</span>}
                <a href={r.url} target="_blank" rel="noreferrer" className="rel-tag">{r.tag}</a>
                {r.is_prerelease && <Badge on={f.ch === 'pre'} enabled onClick={() => set({ ch: f.ch === 'pre' ? 'all' : 'pre' })} className="pill pill-sm" title="Show pre-releases only">pre-release</Badge>}
              </div>
              {(r.flags.some(x => x !== 'prerelease') || r.wave_id || r.networks.length > 0) && (
                <div className="rel-flags">
                  {r.flags.filter(x => x !== 'prerelease').map(x => {
                    const meta = TYPE_META.get(x); const Icon = meta?.icon; const tone = flagTone(x);
                    return <Badge key={x} on={f.type.includes(x)} enabled={can('type')} onClick={() => toggle('type', x)} className={`pill pill-sm ${tone === 'neutral' ? '' : `pill-${tone}`}`} title={`Filter: ${meta?.label ?? x}`}>{Icon && <Icon aria-hidden />}{meta?.label ?? x}</Badge>;
                  })}
                  {r.wave_id && <Badge on={f.fork.includes(r.wave_id)} enabled={can('fork')} onClick={() => toggle('fork', r.wave_id!)} className="pill pill-accent pill-sm" title={`Filter: ${waveName(r.wave_id)}`}>{waveName(r.wave_id)}</Badge>}
                  {r.networks.map(n => <Badge key={n} on={f.net.includes(n)} enabled={can('net')} onClick={() => toggle('net', n)} className="pill pill-sm" title={`Filter: ${n}`}><NetDot id={n} />{n}</Badge>)}
                </div>
              )}
              {r.evidence?.length > 0 && (
                <details className="rel-evidence">
                  <summary><ChevronRight aria-hidden />Why this rating</summary>
                  <ul>{r.evidence.slice(0, 5).map((e, i) => <li key={i}>{e.text}</li>)}</ul>
                </details>
              )}
            </div>
          </div>
          <div className="rel-date">{fmtDate(r.published_at)}</div>
        </div>
      ))}
      {filtered.length > limit && (
        <div className="show-more">
          <button type="button" className="btn btn-sm" onClick={() => setLimit(l => l + pageSize)}>Show {Math.min(pageSize, filtered.length - limit)} more<span className="faint">· {filtered.length - limit} left</span></button>
        </div>
      )}
    </div>
  );

  if (layout === 'sidebar') {
    return (
      <div className="rel-browser">
        <aside className={`card facet-panel ${panelOpen ? 'open' : ''}`} aria-label="Release filters">
          <div className="facet-panel-head">
            <span className="h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><SlidersHorizontal aria-hidden width={16} height={16} />Filters</span>
            {activeCount > 0 && <button type="button" className="btn btn-xs btn-quiet" onClick={clear}>Clear</button>}
          </div>
          {searchBox}
          <div className="facet" role="group" aria-label="Channel"><div className="facet-label">Channel</div>{channel}</div>
          <div className="facet" role="group" aria-label="Published">
            <div className="facet-label">Published</div>
            <div className="seg">
              {(['7d', '30d', '90d', 'all'] as const).map(r => <button key={r} type="button" aria-pressed={f.range === r} onClick={() => set({ range: r })}>{r === 'all' ? 'Any time' : r}</button>)}
            </div>
          </div>
          {groups}
        </aside>
        <section className="card rel-results">{head}{list}</section>
      </div>
    );
  }
  return (
    <div className="rel-inline">
      <div className="facet-bar">
        {searchBox}
        <div className="facet" role="group" aria-label="Channel"><div className="facet-label">Channel</div>{channel}</div>
        {groups}
      </div>
      {head}
      {list}
    </div>
  );
}

function Badge({ on, enabled, onClick, className, title, children }: { on: boolean; enabled: boolean; onClick: () => void; className: string; title: string; children: ReactNode }) {
  if (!enabled) return <span className={className}>{children}</span>;
  return <button type="button" className={`${className} badge-btn ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={onClick} title={title}>{children}</button>;
}

function ActiveChip({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <span className="achip">
      {children}
      <button type="button" className="icon-btn icon-btn-sm" aria-label="Remove filter" onClick={onRemove}><X aria-hidden /></button>
    </span>
  );
}

'use client';
import { useMemo, useState } from 'react';
import type { TimelineRow } from '@/lib/types';
import { fmtDate } from '@/lib/format';
import { Flag, SeverityBadge } from './ui';

const LEVELS = ['all', 'critical', 'high', 'recommended'] as const;
type Level = (typeof LEVELS)[number];
const RANK: Record<string, number> = { critical: 4, high: 3, recommended: 2, optional: 1, unassessed: 0 };

export function ReleaseList({ rows, initialLevel = 'all', showPrereleaseToggle = true, emptyText, linkComponents = true }: {
  rows: TimelineRow[]; initialLevel?: Level; showPrereleaseToggle?: boolean; emptyText?: string; linkComponents?: boolean;
}) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [pre, setPre] = useState(true);
  const filtered = useMemo(() => rows.filter(r =>
    (level === 'all' || RANK[r.severity]! >= RANK[level]!) && (pre || !r.is_prerelease),
  ), [rows, level, pre]);
  const counts = useMemo(() => Object.fromEntries(LEVELS.map(l => [l, rows.filter(r => (l === 'all' || RANK[r.severity]! >= RANK[l]!) && (pre || !r.is_prerelease)).length])), [rows, pre]);

  return (
    <div>
      <div className="filters" style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <div className="seg" role="group" aria-label="Minimum severity">
          {LEVELS.map(l => (
            <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>
              {l === 'all' ? 'All' : `${l[0]!.toUpperCase()}${l.slice(1)}${l === 'critical' ? '' : '+'}`} <span className="faint">{counts[l]}</span>
            </button>
          ))}
        </div>
        {showPrereleaseToggle && (
          <label className="toggle" style={{ marginLeft: 'auto' }}>
            <input type="checkbox" checked={pre} onChange={e => setPre(e.target.checked)} /> Show pre-releases
          </label>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="empty">{emptyText ?? 'No releases match these filters.'}</div>
      ) : (
        <div className="rel-list">
          {filtered.map(r => (
            <div key={`${r.component_slug}@${r.tag}`} className="rel-row">
              <div className="sev-cell"><SeverityBadge severity={r.severity} /></div>
              <div className="rel-main">
                <div className="rel-title">
                  {linkComponents ? <a href={`/c/${r.component_slug}`} className="rel-comp">{r.component_name}</a> : <span className="rel-comp">{r.component_name}</span>}
                  <a href={r.url} target="_blank" rel="noreferrer" className="rel-tag">{r.tag}</a>
                  {r.is_prerelease && <span className="tag">pre-release</span>}
                </div>
                {(r.flags.length > 0 || r.wave_id || r.networks.length > 0) && (
                  <div className="rel-flags">
                    {r.flags.filter(f => f !== 'prerelease').map(f => <Flag key={f} flag={f} />)}
                    {r.wave_id && <span className="chip chip-accent">{r.wave_id}</span>}
                    {r.networks.map(n => <span key={n} className="chip">{n}</span>)}
                  </div>
                )}
                {r.evidence?.length > 0 && (
                  <details className="rel-evidence">
                    <summary>Why this rating ({r.evidence.length})</summary>
                    <ul>{r.evidence.slice(0, 5).map((e, i) => <li key={i}>{e.text}</li>)}</ul>
                  </details>
                )}
              </div>
              <div className="rel-date">{fmtDate(r.published_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

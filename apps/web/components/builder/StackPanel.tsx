'use client';
import { useState } from 'react';
import type { Catalog, ClusterNode } from '@stakestack/shared/types';
import type { ComposeResult } from '@stakestack/shared/composer';
import { ROLE_LABEL } from '@stakestack/shared/topology';
import { fmtDate, relative, waveName } from '@/lib/format';
import { Diag, NetDot } from '../ui';

export interface LiveReadiness {
  networks: Array<{
    id: string; name: string; phase: 'activated' | 'upcoming' | 'tba' | 'none'; wave: string | null; activation_time: string | null; tentative: boolean;
    summary: { ready: number; behind: number; unknown: number };
    components: Array<{ slug: string; required: string | null; latest: string | null; state: string }>;
  }>;
}

const CORE = ['execution', 'consensus', 'validator'];

export function StackPanel({ catalog, result, nodes, name, onName, onRemove, onAddRecommended, readiness, readinessLoading, onSave, saving, saved, canSave, onReset }: {
  catalog: Catalog;
  result: ComposeResult;
  nodes: ClusterNode[];
  name: string;
  onName: (v: string) => void;
  onRemove: (slot: string, slug: string) => void;
  onAddRecommended: () => void;
  readiness: LiveReadiness | null;
  readinessLoading: boolean;
  onSave: () => void;
  saving: boolean;
  saved: string | null;
  canSave: boolean;
  onReset: () => void;
}) {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const nm = (s?: string) => (s ? bySlug.get(s)?.name ?? s : '—');
  const errors = result.diagnostics.filter(d => d.level === 'error');
  const warns = result.diagnostics.filter(d => d.level === 'warn');
  const notes = result.diagnostics.filter(d => d.level === 'info');
  const addons = result.slots.filter(s => s.visible && s.slot.id !== 'network' && !CORE.includes(s.slot.id) && s.slot.id !== 'dvt' && s.selected.length);
  const middleware = result.selection.dvt?.[0];
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <aside className="builder-aside" id="your-stack">
      <div className="card">
        <div className="card-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Your stack</h2>
            {errors.length > 0 ? <span className="chip chip-err">{errors.length} to fix</span>
              : warns.length > 0 ? <span className="chip chip-warn">{warns.length} warning{warns.length > 1 ? 's' : ''}</span>
              : <span className="chip chip-ok">Valid</span>}
          </div>
          <input className="input" value={name} onChange={e => onName(e.target.value)} aria-label="Stack name" placeholder="Stack name" />
        </div>

        {/* networks */}
        <div className="panel-section">
          <div className="panel-label">Networks</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {result.networks.length === 0 && <span className="faint" style={{ fontSize: 13 }}>None selected</span>}
            {result.networks.map(n => <span key={n} className="sel-chip static"><NetDot id={n} />&nbsp;{catalog.networks.find(x => x.id === n)?.name ?? n}</span>)}
          </div>
        </div>

        {/* core / cluster */}
        <div className="panel-section">
          <div className="panel-label">
            {result.cluster ? `Cluster · ${nm(middleware)}` : 'Clients'}
            {result.topology && result.topology.n >= 3 && <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>{result.topology.threshold}/{result.topology.n} · tolerates {result.topology.tolerance}</span>}
          </div>
          {result.cluster ? (
            <table className="mini-table">
              <thead><tr><th>Node</th>{result.cluster.roles.map(r => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
              <tbody>
                {nodes.map((node, i) => (
                  <tr key={i}>
                    <td className="node-name" title={node.label || undefined}>{node.label || `node-${i + 1}`}</td>
                    {result.cluster!.roles.map(r => <td key={r} className={node[r] ? '' : 'faint'} title={nm(node[r])}>{node[r] ? nm(node[r]) : 'not set'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <dl className="kv">
              {CORE.map(id => {
                const s = result.slots.find(x => x.slot.id === id);
                if (!s?.visible) return null;
                const embedded = id === 'validator' && s.selected.length === 0 && (result.selection.consensus ?? []).some(c => bySlug.get(c)?.embeds?.includes('validator'));
                return (
                  <div key={id} style={{ display: 'contents' }}>
                    <dt>{ROLE_LABEL[id as 'execution']} · {id}</dt>
                    <dd>
                      {s.selected.map(slug => (
                        <span key={slug} className="sel-chip">{nm(slug)}<button type="button" className="icon-btn" aria-label={`Remove ${nm(slug)}`} onClick={() => onRemove(id, slug)}>×</button></span>
                      ))}
                      {s.selected.length === 0 && <span className={embedded ? 'muted' : 'faint'} style={{ fontSize: 13 }}>{embedded ? 'Built into CL' : 'Not chosen'}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>

        {/* add-ons */}
        <div className="panel-section">
          <div className="panel-label">
            Add-ons
            {result.recommended.length > 0 && <button type="button" className="btn btn-sm btn-ghost" style={{ height: 24, textTransform: 'none', letterSpacing: 0 }} onClick={onAddRecommended}>+ {result.recommended.length} recommended</button>}
          </div>
          {addons.length === 0 ? <span className="faint" style={{ fontSize: 13 }}>Nothing added yet</span> : (
            <dl className="kv">
              {addons.map(s => (
                <div key={s.slot.id} style={{ display: 'contents' }}>
                  <dt>{s.slot.label.replace(/ \(.+\)$/, '')}</dt>
                  <dd>{s.selected.map(slug => <span key={slug} className="sel-chip">{nm(slug)}<button type="button" className="icon-btn" aria-label={`Remove ${nm(slug)}`} onClick={() => onRemove(s.slot.id, slug)}>×</button></span>)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* checks */}
        <div className="panel-section">
          <div className="panel-label">Checks</div>
          {errors.length === 0 && warns.length === 0 && <Diag level="info">No problems found.</Diag>}
          {errors.map((d, i) => <Diag key={`e${i}`} level="error">{d.message}</Diag>)}
          {warns.map((d, i) => <Diag key={`w${i}`} level="warn">{d.message}</Diag>)}
          {notes.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="faint" style={{ fontSize: 12.5, cursor: 'pointer' }}>Operator notes ({notes.length})</summary>
              <div style={{ marginTop: 6 }}>{notes.map((d, i) => <Diag key={`n${i}`} level="info">{d.message}</Diag>)}</div>
            </details>
          )}
        </div>

        {/* readiness */}
        <div className="panel-section">
          <div className="panel-label">Fork readiness {readinessLoading && <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>updating…</span>}</div>
          {!readiness || readiness.networks.length === 0 ? <span className="faint" style={{ fontSize: 13 }}>Pick a network and clients.</span> : readiness.networks.map(n => {
            const behind = n.components.filter(c => c.state === 'behind');
            return (
              <div key={n.id}>
                <div className="mini-net">
                  <NetDot id={n.id} />
                  <div className="grow">
                    <b style={{ fontWeight: 600 }}>{n.name}</b>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {n.wave ? `${waveName(n.wave)} · ` : ''}
                      {n.phase === 'activated' ? `activated ${fmtDate(n.activation_time)}` : n.phase === 'upcoming' ? `${n.tentative ? 'tentative ' : ''}${fmtDate(n.activation_time)} (${relative(n.activation_time)})` : n.phase === 'tba' ? 'date TBA' : 'no upgrade'}
                    </div>
                  </div>
                  {behind.length > 0 ? <span className="chip chip-err">{behind.length} behind</span>
                    : n.components.some(c => c.required) ? <span className="chip chip-ok">Ready</span>
                    : <span className="chip">No min. versions</span>}
                </div>
                {behind.length > 0 && (
                  <div style={{ margin: '0 0 6px 17px', fontSize: 12.5 }} className="muted">
                    {behind.map(c => <div key={c.slug}>{nm(c.slug)}: needs ≥ <span className="mono">{c.required}</span>, latest seen <span className="mono">{c.latest ?? '—'}</span></div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* actions */}
        <div className="panel-section" style={{ display: 'grid', gap: 8 }}>
          <button type="button" className="btn btn-primary btn-block" disabled={!canSave || saving || errors.length > 0} onClick={onSave}>
            {saving ? 'Saving…' : errors.length > 0 ? 'Fix the checks to save' : 'Save & get share link'}
          </button>
          {saved && (
            <div className="diag diag-info" style={{ flexDirection: 'column', gap: 6 }}>
              <span>Saved. <a href={`/s/${saved}`}>Open stack page →</a></span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm" onClick={() => copy(`${location.origin}/s/${saved}`)}>{copied ? 'Copied' : 'Copy link'}</button>
                <a className="btn btn-sm" href={`/api/feed/${saved}.rss`}>RSS</a>
                <a className="btn btn-sm" href={`/api/feed/${saved}.json`}>JSON</a>
              </div>
            </div>
          )}
          {!canSave && <span className="faint" style={{ fontSize: 12.5 }}>Saving is disabled on this deployment.</span>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>Reset builder</button>
        </div>
      </div>
    </aside>
  );
}

'use client';
import { useState } from 'react';
import { Check, Copy, CopyPlus, Link2, RotateCcw, Rss, Save, Share2, ShoppingBag, Sparkles, UserPlus, X } from 'lucide-react';
import type { Catalog, ClusterNode } from '@stakestack/shared/types';
import type { ComposeResult } from '@stakestack/shared/composer';
import { ROLE_LABEL } from '@stakestack/shared/topology';
import { fmtDate, relative, waveName } from '@/lib/format';
import { Diag, NetDot, Pill, StatusPill } from '../ui';
import { Logo } from '../Logo';
import { ROLE_SHORT, slotShort } from './meta';

/** Save state for signed-in members; `enabled` is false when the deployment has no sign-in. */
export interface MemberSave {
  enabled: boolean;
  signedIn: boolean;
  currentId: string | null;
  dirty: boolean;
  /** Share slug of the open saved stack. */
  slug: string | null;
  onSave: (asNew: boolean) => void;
  onSignUp: () => void;
}

export interface LiveReadiness {
  networks: Array<{
    id: string; name: string; phase: 'activated' | 'upcoming' | 'tba' | 'none'; wave: string | null; activation_time: string | null; tentative: boolean;
    summary: { ready: number; behind: number; unknown: number };
    components: Array<{ slug: string; required: string | null; latest: string | null; state: string }>;
  }>;
}

const CORE = ['execution', 'consensus', 'validator'];

/** The "cart": everything picked so far, its checks, fork readiness and the save action. */
export function StackPanel({ catalog, result, nodes, name, onName, onRemove, onAddRecommended, readiness, readinessLoading, onSave, saving, saved, canSave, onReset, member }: {
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
  member: MemberSave;
}) {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const comp = (s?: string) => (s ? bySlug.get(s) : undefined);
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
  const share = (slug: string, title: string) => (
    <div className="share-box">
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check aria-hidden width={15} height={15} />{title} <a href={`/s/${slug}`}>Open stack page</a></span>
      <div className="row">
        <button type="button" className="btn btn-xs" onClick={() => copy(`${location.origin}/s/${slug}`)}>{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? 'Copied' : 'Copy link'}</button>
        <a className="btn btn-xs" href={`/api/feed/${slug}.rss`}><Rss aria-hidden />RSS</a>
        <a className="btn btn-xs" href={`/api/feed/${slug}.json`}><Link2 aria-hidden />JSON</a>
      </div>
    </div>
  );

  const core = CORE.flatMap(id => {
    const s = result.slots.find(x => x.slot.id === id);
    if (!s?.visible || result.cluster) return [];
    if (s.selected.length === 0) {
      const embedded = id === 'validator' && (result.selection.consensus ?? []).some(c => bySlug.get(c)?.embeds?.includes('validator'));
      return [{ id, slug: null as string | null, embedded }];
    }
    return s.selected.map(slug => ({ id, slug, embedded: false }));
  });
  const itemCount = result.effectiveComponents.length;

  return (
    <aside className="card cart" id="your-stack" aria-label="Your stack">
      <div className="cart-head">
        <div className="cart-title"><ShoppingBag aria-hidden />Your stack<StatusPill errors={errors.length} warnings={warns.length} /></div>
        <input className="field field-sm" value={name} onChange={e => onName(e.target.value)} aria-label="Stack name" placeholder="Stack name" />
      </div>

      <div className="cart-section">
        <div className="cart-label"><span className="eyebrow">Networks</span></div>
        <div className="cart-nets">
          {result.networks.length === 0 && <span className="meta">None selected</span>}
          {result.networks.map(n => <Pill key={n} className="pill-outline"><NetDot id={n} />{catalog.networks.find(x => x.id === n)?.name ?? n}</Pill>)}
        </div>
      </div>

      <div className="cart-section">
        <div className="cart-label">
          <span className="eyebrow">{result.cluster ? `Cluster · ${nm(middleware)}` : 'Clients'}</span>
          {result.topology && result.topology.n >= 3 && <span className="meta">{result.topology.threshold}/{result.topology.n} · tolerates {result.topology.tolerance}</span>}
        </div>
        {result.cluster ? (
          <table className="mini-table">
            <thead><tr><th>Node</th>{result.cluster.roles.map(r => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {nodes.map((node, i) => (
                <tr key={i}>
                  <td title={node.label || undefined} style={{ fontWeight: 600 }}>{node.label || `node-${i + 1}`}</td>
                  {result.cluster!.roles.map(r => (
                    <td key={r} title={nm(node[r])}>
                      {node[r] ? <span className="comp-cell"><Logo logo={comp(node[r])?.logo} name={nm(node[r])} size={18} /><span>{nm(node[r])}</span></span> : <span className="faint">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="cart-items">
            {core.map(item => item.slug ? (
              <div key={`${item.id}-${item.slug}`} className="cart-item">
                <Logo logo={comp(item.slug)?.logo} name={nm(item.slug)} size={30} />
                <span><b>{nm(item.slug)}</b><span className="meta">{ROLE_SHORT[item.id]} · {slotShort(item.id, item.id)}</span></span>
                <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${nm(item.slug)}`} onClick={() => onRemove(item.id, item.slug!)}><X aria-hidden /></button>
              </div>
            ) : (
              <div key={item.id} className="cart-item">
                <span className="logo" style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-inset)', boxShadow: 'inset 0 0 0 1px var(--color-line)' }} aria-hidden />
                <span><b className={item.embedded ? '' : 'faint'} style={{ fontWeight: 500 }}>{item.embedded ? 'Built into CL' : `No ${ROLE_SHORT[item.id]} yet`}</b><span className="meta">{ROLE_SHORT[item.id]} · {slotShort(item.id, item.id)}</span></span>
                <span />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cart-section">
        <div className="cart-label">
          <span className="eyebrow">Add-ons</span>
          {result.recommended.length > 0 && <button type="button" className="btn btn-xs btn-ghost" onClick={onAddRecommended}><Sparkles aria-hidden />Add {result.recommended.length} recommended</button>}
        </div>
        {addons.length === 0 ? <span className="meta">Nothing added yet</span> : (
          <div className="cart-items">
            {addons.flatMap(s => s.selected.map(slug => (
              <div key={`${s.slot.id}-${slug}`} className="cart-item">
                <Logo logo={comp(slug)?.logo} name={nm(slug)} size={30} />
                <span><b>{nm(slug)}</b><span className="meta">{slotShort(s.slot.id, s.slot.label)}</span></span>
                <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${nm(slug)}`} onClick={() => onRemove(s.slot.id, slug)}><X aria-hidden /></button>
              </div>
            )))}
          </div>
        )}
      </div>

      <div className="cart-section">
        <div className="cart-label"><span className="eyebrow">Checks</span></div>
        {errors.length === 0 && warns.length === 0 && <Diag level="ok">No problems found</Diag>}
        {errors.map((d, i) => <Diag key={`e${i}`} level="error">{d.message}</Diag>)}
        {warns.map((d, i) => <Diag key={`w${i}`} level="warn">{d.message}</Diag>)}
        {notes.length > 0 && (
          <details className="rel-evidence" style={{ marginTop: 8 }}>
            <summary>Operator notes ({notes.length})</summary>
            <div style={{ marginTop: 6 }}>{notes.map((d, i) => <Diag key={`n${i}`} level="info">{d.message}</Diag>)}</div>
          </details>
        )}
      </div>

      <div className="cart-section">
        <div className="cart-label"><span className="eyebrow">Fork readiness</span>{readinessLoading && <span className="meta">updating…</span>}</div>
        {!readiness || readiness.networks.length === 0 ? <span className="meta">Pick a network and clients.</span> : readiness.networks.map(n => {
          const behind = n.components.filter(c => c.state === 'behind');
          return (
            <div key={n.id}>
              <div className="ready-row">
                <NetDot id={n.id} />
                <div className="grow">
                  <b>{n.name}</b>
                  <div className="meta">
                    {n.wave ? `${waveName(n.wave)} · ` : ''}
                    {n.phase === 'activated' ? `live ${fmtDate(n.activation_time)}` : n.phase === 'upcoming' ? `${n.tentative ? '~' : ''}${relative(n.activation_time)}` : n.phase === 'tba' ? 'date TBA' : 'no upgrade'}
                  </div>
                </div>
                {behind.length > 0 ? <Pill tone="danger">{behind.length} behind</Pill>
                  : n.components.some(c => c.required) ? <Pill tone="ok"><Check aria-hidden />Ready</Pill>
                  : <Pill>No minimums</Pill>}
              </div>
              {behind.length > 0 && (
                <div className="ready-behind">
                  {behind.map(c => <div key={c.slug}>{nm(c.slug)} needs ≥ <span className="mono">{c.required}</span> · latest <span className="mono">{c.latest ?? '—'}</span></div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cart-section cart-actions">
        {member.signedIn ? (
          <>
            <button type="button" className="btn btn-primary btn-block" disabled={saving || errors.length > 0 || (!!member.currentId && !member.dirty)} onClick={() => member.onSave(false)}>
              {member.currentId && !member.dirty ? <Check aria-hidden /> : <Save aria-hidden />}
              {saving ? 'Saving…' : errors.length > 0 ? 'Fix checks to save' : member.currentId ? (member.dirty ? 'Save changes' : 'Saved to my stacks') : `Save to my stacks · ${itemCount} items`}
            </button>
            {member.currentId && <button type="button" className="btn btn-sm" disabled={saving || errors.length > 0} onClick={() => member.onSave(true)}><CopyPlus aria-hidden />Save as new stack</button>}
            {member.slug && !member.dirty && share(member.slug, 'Share link')}
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-block" disabled={!canSave || saving || errors.length > 0} onClick={onSave}>
              <Share2 aria-hidden />{saving ? 'Saving…' : errors.length > 0 ? 'Fix checks to save' : `Save & share · ${itemCount} items`}
            </button>
            {saved && share(saved, 'Saved.')}
            {saved && member.enabled && (
              <div className="signup-cta">
                <b><UserPlus aria-hidden />Keep it in your account</b>
                <p>Sign up with GitHub or Google to save this stack, build more, and see your tools first.</p>
                <button type="button" className="btn btn-sm btn-primary" onClick={member.onSignUp}><UserPlus aria-hidden />Sign up free</button>
              </div>
            )}
            {!canSave && <span className="meta">Saving is off on this deployment.</span>}
          </>
        )}
        <button type="button" className="btn btn-sm btn-quiet" onClick={onReset} disabled={!!member.currentId && !member.dirty}>
          <RotateCcw aria-hidden />{member.currentId ? 'Revert changes' : 'Reset'}
        </button>
      </div>
    </aside>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compose } from '@stakestack/shared/composer';
import { diversify } from '@stakestack/shared/topology';
import { upgradePhase } from '@stakestack/shared/readiness';
import { PRESETS, type Preset } from '@stakestack/shared/presets';
import type { Catalog, ClusterNode, ClusterRole, Component, StackSelection } from '@stakestack/shared/types';
import { fmtDate, relative, waveName } from '@/lib/format';
import { NetDot } from '../ui';
import { OptionGrid } from './OptionGrid';
import { ClusterEditor } from './ClusterEditor';
import { StackPanel, type LiveReadiness } from './StackPanel';

const DRAFT_KEY = 'stakestack:draft:v2';
const CORE: ClusterRole[] = ['execution', 'consensus', 'validator'];
type Mode = 'single' | 'dvt';

const solo = PRESETS[0]!;

export function StackBuilder({ catalog, canSave }: { catalog: Catalog; canSave: boolean }) {
  const [sel, setSel] = useState<StackSelection>(solo.selection);
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [mode, setMode] = useState<Mode>('single');
  const [name, setName] = useState('My validator stack');
  const [query, setQuery] = useState('');
  const [readiness, setReadiness] = useState<LiveReadiness | null>(null);
  const [rLoading, setRLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const loaded = useRef(false);

  const bySlug = useMemo(() => new Map(catalog.components.map(c => [c.slug, c])), [catalog]);
  const result = useMemo(() => compose(catalog, sel, nodes.length ? { nodes } : null), [catalog, sel, nodes]);
  const slotView = (id: string) => result.slots.find(s => s.slot.id === id)!;
  const allowed = (r: ClusterRole) => slotView(r)?.options ?? [];
  const recommended = useMemo(() => new Set(result.recommended), [result.recommended]);

  // ------------------------------------------------------------- draft I/O --
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { sel: StackSelection; nodes: ClusterNode[]; name: string; mode: Mode };
        setSel(d.sel); setNodes(d.nodes ?? []); setName(d.name ?? 'My validator stack'); setMode(d.mode ?? (d.sel.dvt?.length ? 'dvt' : 'single'));
      }
    } catch { /* storage unavailable */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ sel, nodes, name, mode })); } catch { /* ignore */ }
    setSaved(null);
  }, [sel, nodes, name, mode]);

  // ------------------------------------------------------- live readiness --
  const readinessKey = JSON.stringify([result.selection, nodes]);
  useEffect(() => {
    const ctl = new AbortController();
    setRLoading(true);
    const t = setTimeout(() => {
      fetch('/api/readiness', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ selection: sel, topology: nodes.length ? { nodes } : null }), signal: ctl.signal })
        .then(r => (r.ok ? r.json() : null)).then(j => { if (j) setReadiness(j as LiveReadiness); }).catch(() => {}).finally(() => setRLoading(false));
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readinessKey]);

  // ------------------------------------------------------------- actions --
  const toggle = useCallback((slotId: string, slug: string) => {
    const card = slotView(slotId)?.cardinality ?? 'one';
    setSel(prev => {
      const cur = prev[slotId] ?? [];
      const next = card === 'one' ? (cur[0] === slug ? [] : [slug]) : cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug];
      const out: StackSelection = { ...prev, [slotId]: next };
      // Single node: the VC follows the CL when the CL has one built in.
      if (slotId === 'consensus') {
        const prevCl = cur[0];
        const vc = prev.validator ?? [];
        const following = vc.length === 0 || vc[0] === prevCl;
        const cl = next[0] ? bySlug.get(next[0]) : undefined;
        if (following) out.validator = cl?.embeds?.includes('validator') ? [cl.slug] : [];
      }
      return out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, bySlug]);

  const remove = (slotId: string, slug: string) => setSel(prev => ({ ...prev, [slotId]: (prev[slotId] ?? []).filter(s => s !== slug) }));

  const applyPreset = (p: Preset) => {
    setSel(p.selection); setNodes(p.topology?.nodes ?? []); setName(p.name);
    setMode(p.selection.dvt?.length ? 'dvt' : 'single');
  };

  const nodesFor = (draft: StackSelection, n?: number, keep?: ClusterNode[]): ClusterNode[] => {
    const r = compose(catalog, draft, null);
    if (!r.cluster) return [];
    const al = Object.fromEntries(CORE.map(role => [role, r.slots.find(s => s.slot.id === role)?.options.map(o => o.slug) ?? []])) as Record<ClusterRole, string[]>;
    const count = n ?? keep?.length ?? r.cluster.default_nodes ?? 4;
    if (keep && keep.length) {
      return keep.slice(0, count).map(node => ({
        label: node.label,
        execution: node.execution && al.execution.includes(node.execution) ? node.execution : undefined,
        consensus: node.consensus && al.consensus.includes(node.consensus) ? node.consensus : undefined,
        validator: r.cluster!.roles.includes('validator')
          ? (node.validator && al.validator.includes(node.validator) ? node.validator : node.consensus && al.validator.includes(node.consensus) && bySlug.get(node.consensus)?.embeds?.includes('validator') ? node.consensus : undefined)
          : undefined,
      }));
    }
    return diversify(catalog, count, r.cluster.roles, { allowed: al });
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    if (m === 'dvt') {
      const draft = { ...sel, dvt: sel.dvt?.length ? sel.dvt : ['charon'] };
      setSel(draft);
      setNodes(nodesFor(draft));
    } else {
      const first = nodes[0];
      setSel(prev => ({
        ...prev, dvt: [], 'dvt-extras': [],
        execution: first?.execution ? [first.execution] : prev.execution ?? [],
        consensus: first?.consensus ? [first.consensus] : prev.consensus ?? [],
        validator: first?.validator ? [first.validator] : first?.consensus && bySlug.get(first.consensus)?.embeds?.includes('validator') ? [first.consensus] : prev.validator ?? [],
      }));
      setNodes([]);
    }
  };

  const pickMiddleware = (slug: string) => {
    const draft = { ...sel, dvt: [slug], 'dvt-extras': [] };
    setSel(draft);
    const r = compose(catalog, draft, null);
    if (!r.cluster) { setNodes([]); return; }
    setNodes(nodes.length ? nodesFor(draft, nodes.length, nodes) : nodesFor(draft));
  };

  const addRecommended = () => {
    setSel(prev => {
      const out = { ...prev };
      for (const slug of result.recommended) {
        const slot = result.slots.find(s => s.visible && s.options.some(o => o.slug === slug) && !['execution', 'consensus', 'validator', 'dvt'].includes(s.slot.id));
        if (!slot) continue;
        const cur = out[slot.slot.id] ?? [];
        out[slot.slot.id] = slot.cardinality === 'one' ? [slug] : cur.includes(slug) ? cur : [...cur, slug];
      }
      return out;
    });
  };

  const reset = () => { applyPreset(solo); setName('My validator stack'); setQuery(''); };

  const save = async () => {
    setSaving(true); setSaved(null);
    try {
      const res = await fetch('/api/stacks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, selection: sel, topology: result.cluster ? { nodes } : null }) });
      const json = await res.json() as { slug?: string; error?: string };
      if (json.slug) setSaved(json.slug); else alert(json.error ?? 'Saving failed');
    } finally { setSaving(false); }
  };

  // ------------------------------------------------------------- render --
  const networks = catalog.networks.filter(n => !n.deprecated).sort((a, b) => (a.rollout_order || 9) - (b.rollout_order || 9));
  const dvtSlot = slotView('dvt');
  const middleware = sel.dvt?.[0];
  const addons = result.slots.filter(s => s.visible && !['network', 'execution', 'consensus', 'validator', 'dvt'].includes(s.slot.id));
  const clBuiltIn = (sel.consensus ?? []).find(s => bySlug.get(s)?.embeds?.includes('validator'));

  return (
    <div className="builder">
      <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
        {/* 0. presets */}
        <section>
          <div className="step"><span className="step-num">1</span><div><h2>Start from a template</h2><p>Or skip and pick everything below. Your draft is saved in this browser.</p></div></div>
          <div className="presets">
            {PRESETS.map(p => (
              <button key={p.id} type="button" className="preset" onClick={() => applyPreset(p)}>
                <b>{p.name}</b><span>{p.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 1. networks */}
        <section>
          <div className="step"><span className="step-num">2</span><div><h2>Networks</h2><p>Forks roll out Sepolia → Hoodi → Mainnet. Add Hoodi to rehearse each upgrade.</p></div></div>
          <div className="net-pick">
            {networks.map(n => {
              const on = (sel.network ?? []).includes(n.id);
              const up = catalog.upgrades
                .filter(u => u.network === n.id && u.status !== 'cancelled' && u.status !== 'draft')
                .sort((a, b) => (b.activation_time ?? '9999').localeCompare(a.activation_time ?? '9999'))[0] ?? null;
              const ph = upgradePhase(up);
              return (
                <button key={n.id} type="button" className="opt" aria-pressed={on} onClick={() => toggle('network', n.id)}>
                  <span className="name" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><NetDot id={n.id} />{n.name}</span>
                  <span className="meta">{n.kind === 'mainnet' ? 'Production' : n.kind === 'ephemeral' ? 'Resets periodically' : 'Testnet'}</span>
                  {up && (
                    <span className="badges">
                      <span className={`chip ${ph === 'activated' ? 'chip-ok' : ph === 'upcoming' ? 'chip-accent' : ''}`}>
                        {waveName(up.wave)} · {ph === 'activated' ? `live ${fmtDate(up.activation_time)}` : ph === 'upcoming' ? `${up.tentative ? '~' : ''}${relative(up.activation_time)}` : 'TBA'}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. setup */}
        <section className="card">
          <div className="card-head">
            <div className="step" style={{ margin: 0 }}><span className="step-num">3</span><div><h2>Clients</h2><p>One machine, or a distributed validator cluster with different clients per node.</p></div></div>
            <div className="seg" role="group" aria-label="Setup type">
              <button type="button" aria-pressed={mode === 'single'} onClick={() => switchMode('single')}>Single node</button>
              <button type="button" aria-pressed={mode === 'dvt'} onClick={() => switchMode('dvt')}>DVT cluster</button>
            </div>
          </div>

          {mode === 'dvt' && (
            <div className="slot">
              <div className="slot-head"><h3>DVT middleware<span className="req">*</span></h3></div>
              <OptionGrid options={dvtSlot?.options ?? []} selected={sel.dvt ?? []} onToggle={pickMiddleware} />
            </div>
          )}

          {mode === 'dvt' && result.cluster ? (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <ClusterEditor
                spec={result.cluster}
                nodes={nodes}
                onChange={setNodes}
                allowed={{ execution: allowed('execution'), consensus: allowed('consensus'), validator: allowed('validator') }}
                analysis={result.topology}
                middleware={bySlug.get(middleware ?? '')?.name ?? 'DVT'}
                onDiversify={n => setNodes(nodesFor(sel, n))}
              />
            </div>
          ) : (
            (mode === 'single' || middleware) && CORE.map(id => {
              const s = slotView(id);
              if (!s?.visible) return null;
              return (
                <div key={id} className="slot">
                  <div className="slot-head">
                    <h3>{s.slot.label}{s.required && !(id === 'validator' && clBuiltIn) && <span className="req">*</span>}</h3>
                    {id === 'validator' && clBuiltIn && <span className="faint" style={{ fontSize: 12.5 }}>Optional: {bySlug.get(clBuiltIn)?.name} has a built-in VC</span>}
                  </div>
                  {s.slot.description && <p className="slot-desc">{s.slot.description}</p>}
                  <OptionGrid options={s.options} selected={s.selected} onToggle={slug => toggle(id, slug)} recommended={recommended} query={query} builtIn={id === 'validator' ? clBuiltIn : undefined} />
                </div>
              );
            })
          )}
          {mode === 'dvt' && !middleware && <div className="empty">Pick the DVT middleware to configure the cluster.</div>}
        </section>

        {/* 3. add-ons */}
        <section className="card">
          <div className="card-head">
            <div className="step" style={{ margin: 0 }}><span className="step-num">4</span><div><h2>Add-ons</h2><p>Signers, MEV, protocol modules, orchestration and monitoring.</p></div></div>
          </div>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="search-wrap"><input className="search" placeholder="Search components (name, vendor, tag)…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search components" /></div>
          </div>
          {addons.map(s => (
            <AddonSection key={s.slot.id} label={s.slot.label} description={s.slot.description} count={s.selected.length} forceOpen={!!query || s.selected.length > 0 || s.options.some(o => recommended.has(o.slug))}>
              <OptionGrid options={s.options} selected={s.selected} onToggle={slug => toggle(s.slot.id, slug)} recommended={recommended} query={query} />
            </AddonSection>
          ))}
        </section>
      </div>

      <button type="button" className="mobile-stack-bar" onClick={() => document.getElementById('your-stack')?.scrollIntoView({ behavior: 'smooth' })}>
        <span><b>Your stack</b> · {result.effectiveComponents.length} components{result.cluster && nodes.length ? ` · ${nodes.length} nodes` : ''}</span>
        {(() => { const e = result.diagnostics.filter(d => d.level === 'error').length; const w = result.diagnostics.filter(d => d.level === 'warn').length;
          return e ? <span className="chip chip-err">{e} to fix</span> : w ? <span className="chip chip-warn">{w} warnings</span> : <span className="chip chip-ok">Valid</span>; })()}
      </button>

      <StackPanel
        catalog={catalog} result={result} nodes={nodes} name={name} onName={setName} onRemove={remove} onAddRecommended={addRecommended}
        readiness={readiness} readinessLoading={rLoading} onSave={save} saving={saving} saved={saved} canSave={canSave} onReset={reset}
      />
    </div>
  );
}

function AddonSection({ label, description, count, forceOpen, children }: { label: string; description?: string; count: number; forceOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  return (
    <details className="addon" open={open} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="caret">▸</span><b style={{ fontWeight: 600, fontSize: 14.5 }}>{label}</b>
          {count > 0 && <span className="chip chip-accent">{count} selected</span>}
        </span>
      </summary>
      <div className="addon-body">
        {description && <p className="slot-desc" style={{ margin: '0 0 10px' }}>{description}</p>}
        {children}
      </div>
    </details>
  );
}

export type { Component };

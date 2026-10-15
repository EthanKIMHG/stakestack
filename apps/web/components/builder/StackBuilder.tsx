'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { compose } from '@stakestack/shared/composer';
import { diversify } from '@stakestack/shared/topology';
import { PRESETS, type Preset } from '@stakestack/shared/presets';
import type { Catalog, ClusterNode, ClusterRole, Component, StackSelection } from '@stakestack/shared/types';
import { ChevronRight, CircleCheck, Info, Network, Search, Server, ShoppingBag } from 'lucide-react';
import { ClusterEditor } from './ClusterEditor';
import { NetworkPicker } from './NetworkPicker';
import { ProductGrid, matches } from './ProductGrid';
import { StackPanel, type LiveReadiness } from './StackPanel';
import { StepCard } from './StepCard';
import { TemplatePicker, presetMatches } from './TemplatePicker';
import { DEFAULT_SLOT_ICON, SLOT_ICON, slotShort } from './meta';

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
  // State, not a ref: the save effect must not run in the same commit as the load, or it writes the
  // defaults over the stored draft (and under StrictMode the second load then reads those defaults).
  const [loaded, setLoaded] = useState(false);

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
        if (d?.sel && typeof d.sel === 'object') {
          setSel(d.sel); setNodes(d.nodes ?? []); setName(d.name ?? 'My validator stack'); setMode(d.mode ?? (d.sel.dvt?.length ? 'dvt' : 'single'));
        }
      }
    } catch { /* storage unavailable */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ sel, nodes, name, mode })); } catch { /* ignore */ }
    setSaved(null);
  }, [loaded, sel, nodes, name, mode]);

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
  const middleware = sel.dvt?.[0];
  const dvtSlot = slotView('dvt');
  const addons = result.slots.filter(s => s.visible && !['network', 'execution', 'consensus', 'validator', 'dvt'].includes(s.slot.id));
  const clBuiltIn = (sel.consensus ?? []).find(s => bySlug.get(s)?.embeds?.includes('validator'));
  const netNames = result.networks.map(n => catalog.networks.find(x => x.id === n)?.name ?? n);
  const applied = PRESETS.find(p => presetMatches(p, sel, nodes)) ?? null;
  const coreDone = mode === 'dvt'
    ? !!middleware && nodes.length > 0 && !!result.cluster && nodes.every(n => result.cluster!.roles.every(r => n[r]))
    : !!sel.execution?.length && !!sel.consensus?.length && (!!sel.validator?.length || !!clBuiltIn || !slotView('validator')?.visible);
  const addonCount = addons.reduce((n, s) => n + s.selected.length, 0);
  const errors = result.diagnostics.filter(d => d.level === 'error').length;
  const warns = result.diagnostics.filter(d => d.level === 'warn').length;
  const coreSummary = mode === 'dvt'
    ? (middleware ? `${bySlug.get(middleware)?.name ?? middleware} · ${nodes.length} node${nodes.length === 1 ? '' : 's'}` : 'Pick middleware')
    : [sel.execution?.[0], sel.consensus?.[0]].filter(Boolean).map(s => bySlug.get(s!)?.name ?? s).join(' + ');

  return (
    <div className="builder">
      <div className="builder-main">
        <StepCard n={1} title="Template" done={!!applied} value={<span className="truncate">{applied ? applied.name : 'Optional'}</span>}>
          <TemplatePicker presets={PRESETS} bySlug={bySlug} sel={sel} nodes={nodes} onApply={applyPreset} />
        </StepCard>

        <StepCard n={2} title="Network" done={netNames.length > 0} value={<span className="truncate">{netNames.join(' · ') || 'Pick at least one'}</span>}>
          <NetworkPicker catalog={catalog} selected={sel.network ?? []} onToggle={id => toggle('network', id)} />
        </StepCard>

        <StepCard
          n={3} title="Clients" done={coreDone}
          value={<span className="truncate">{coreSummary}</span>}
          actions={
            <div className="seg" role="group" aria-label="Setup type">
              <button type="button" aria-pressed={mode === 'single'} onClick={() => switchMode('single')}><Server aria-hidden />Single node</button>
              <button type="button" aria-pressed={mode === 'dvt'} onClick={() => switchMode('dvt')}><Network aria-hidden />DVT cluster</button>
            </div>
          }
        >
          {mode === 'dvt' && (
            <div className="step-body">
              <SubHead title="DVT middleware" required hint={dvtSlot?.slot.description} />
              <ProductGrid options={dvtSlot?.options ?? []} selected={sel.dvt ?? []} onToggle={pickMiddleware} />
            </div>
          )}
          {mode === 'dvt' && result.cluster && (
            <ClusterEditor
              spec={result.cluster}
              nodes={nodes}
              onChange={setNodes}
              allowed={{ execution: allowed('execution'), consensus: allowed('consensus'), validator: allowed('validator') }}
              analysis={result.topology}
              middleware={bySlug.get(middleware ?? '')?.name ?? 'DVT'}
              onDiversify={n => setNodes(nodesFor(sel, n))}
            />
          )}
          {(mode === 'single' || (!!middleware && !result.cluster)) && CORE.map(id => {
            const s = slotView(id);
            if (!s?.visible) return null;
            return (
              <div key={id} className="step-body">
                <SubHead
                  title={SLOT_TITLE[id] ?? s.slot.label} required={s.required && !(id === 'validator' && clBuiltIn)} hint={s.slot.description}
                  aside={id === 'validator' && clBuiltIn ? <><CircleCheck aria-hidden width={13} height={13} />{bySlug.get(clBuiltIn)?.name} has one built in</> : undefined}
                />
                <ProductGrid options={s.options} selected={s.selected} onToggle={slug => toggle(id, slug)} recommended={recommended} builtIn={id === 'validator' ? clBuiltIn : undefined} />
              </div>
            );
          })}
        </StepCard>

        <StepCard n={4} title="Add-ons" done={addonCount > 0} value={<span className="truncate">{addonCount ? `${addonCount} added` : 'Optional'}</span>}>
          <AddonShelf addons={addons} recommended={recommended} query={query} onQuery={setQuery} onToggle={toggle} />
        </StepCard>
      </div>

      <button type="button" className="mobile-cart" onClick={() => document.getElementById('your-stack')?.scrollIntoView({ behavior: 'smooth' })}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag aria-hidden width={18} height={18} />
          <span><b>Your stack</b> · {result.effectiveComponents.length} items{errors ? ` · ${errors} to fix` : warns ? ` · ${warns} warnings` : ''}</span>
        </span>
        <span className="go">View<ChevronRight aria-hidden /></span>
      </button>

      <StackPanel
        catalog={catalog} result={result} nodes={nodes} name={name} onName={setName} onRemove={remove} onAddRecommended={addRecommended}
        readiness={readiness} readinessLoading={rLoading} onSave={save} saving={saving} saved={saved} canSave={canSave} onReset={reset}
      />
    </div>
  );
}

const SLOT_TITLE: Record<string, string> = { execution: 'Execution client', consensus: 'Consensus client', validator: 'Validator client' };

function SubHead({ title, required, hint, aside }: { title: string; required?: boolean; hint?: string; aside?: React.ReactNode }) {
  return (
    <div className="sub-head">
      <span className="h3">
        {title}{required && <span className="req" aria-label="required">*</span>}
        {hint && <span className="faint" title={hint} style={{ display: 'inline-flex', cursor: 'help' }}><Info aria-label={hint} width={14} height={14} /></span>}
      </span>
      {aside && <span className="aside">{aside}</span>}
    </div>
  );
}

type SlotList = ReturnType<typeof compose>['slots'];

/** Add-ons as a shop shelf: one category at a time, or every match while searching. */
function AddonShelf({ addons, recommended, query, onQuery, onToggle }: {
  addons: SlotList; recommended: Set<string>; query: string; onQuery: (q: string) => void; onToggle: (slot: string, slug: string) => void;
}) {
  const [tab, setTab] = useState<string | null>(null);
  const active = addons.find(s => s.slot.id === tab) ?? addons[0];
  const searching = query.trim().length > 0;
  const hits = searching ? addons.filter(s => s.options.some(o => matches(o, query))) : [];
  return (
    <>
      <div className="step-body" style={{ display: 'grid', gap: 12 }}>
        <label className="search">
          <Search aria-hidden />
          <input className="field" placeholder="Search signers, MEV, protocols, monitoring…" value={query} onChange={e => onQuery(e.target.value)} aria-label="Search add-ons" />
        </label>
        {!searching && (
          <div className="tabs" role="tablist" aria-label="Add-on categories">
            {addons.map(s => {
              const Icon = SLOT_ICON[s.slot.id] ?? DEFAULT_SLOT_ICON;
              const rec = s.options.some(o => recommended.has(o.slug) && !s.selected.includes(o.slug));
              return (
                <button key={s.slot.id} type="button" role="tab" className="tab" aria-selected={active?.slot.id === s.slot.id} onClick={() => setTab(s.slot.id)} title={s.slot.description}>
                  <Icon aria-hidden />{slotShort(s.slot.id, s.slot.label)}
                  {s.selected.length > 0 ? <span className="tab-count">{s.selected.length}</span> : rec ? <span className="tab-dot" aria-label="has recommendations" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {searching ? (
        hits.length === 0
          ? <div className="empty"><Search aria-hidden />Nothing matches “{query}”.</div>
          : hits.map(s => (
            <div key={s.slot.id} className="step-body">
              <SubHead title={slotShort(s.slot.id, s.slot.label)} />
              <ProductGrid options={s.options} selected={s.selected} onToggle={slug => onToggle(s.slot.id, slug)} recommended={recommended} query={query} />
            </div>
          ))
      ) : active && (
        <div className="step-body" role="tabpanel" aria-label={slotShort(active.slot.id, active.slot.label)}>
          <ProductGrid options={active.options} selected={active.selected} onToggle={slug => onToggle(active.slot.id, slug)} recommended={recommended} />
        </div>
      )}
    </>
  );
}

export type { Component };

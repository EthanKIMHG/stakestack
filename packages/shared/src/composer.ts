import type { Catalog, ClusterRole, ClusterSpec, Component, Rule, Slot, StackSelection, Topology } from './types';
import { analyzeTopology, topologySelection, type TopologyAnalysis } from './topology';

export interface SlotView {
  slot: Slot;
  visible: boolean;
  required: boolean;
  /** Effective cardinality after rules (e.g. DVT turns EL/CL/VC into "many"). */
  cardinality: 'one' | 'many';
  options: Component[];          // after restrictions
  selected: string[];
  /** Filled by the cluster editor rather than by direct picking. */
  managedByCluster: boolean;
}
export interface Diagnostic { level: 'error' | 'warn' | 'info'; rule?: string; slot?: string; node?: number; message: string }
export interface ComposeResult {
  slots: SlotView[];
  diagnostics: Diagnostic[];
  recommended: string[];
  /** Every component slug in the stack, including those that embed other roles. Used for the timeline query. */
  effectiveComponents: string[];
  networks: string[];
  /** Present when a selected component turns the stack into a multi-node cluster (Charon, SSV, ...). */
  cluster: ClusterSpec | null;
  topology: TopologyAnalysis | null;
  /** The selection actually evaluated (cluster roles replaced by the union of node clients). */
  selection: StackSelection;
}

function selectedSlugs(sel: StackSelection): Set<string> {
  const out = new Set<string>();
  for (const [slot, slugs] of Object.entries(sel)) if (slot !== 'network') for (const s of slugs ?? []) out.add(s);
  return out;
}

function ruleFires(rule: Rule, sel: StackSelection, selected: Set<string>): boolean {
  const w = rule.when;
  if (w.component && !selected.has(w.component)) return false;
  if (w.any_of && !w.any_of.some(s => selected.has(s))) return false;
  if (w.slot_filled && !(sel[w.slot_filled]?.length)) return false;
  if (w.network && !(sel.network ?? []).includes(w.network)) return false;
  return true;
}

/**
 * Pure function: given the catalog and a selection (plus an optional DVT
 * topology), compute what the builder should show and which problems the
 * selection has. The web UI, the API and the readiness engine all call this,
 * so rules live in exactly one place.
 */
export function compose(catalog: Catalog, input: StackSelection, topology?: Topology | null): ComposeResult {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  let selection: StackSelection = { ...input };
  let selected = selectedSlugs(selection);

  // Pass 1: which rules fire on the raw selection decides whether we are in cluster mode.
  let cluster: ClusterSpec | null = null;
  for (const rule of catalog.rules) if (rule.then.cluster && ruleFires(rule, selection, selected)) cluster = rule.then.cluster;

  // In cluster mode the node table is the source of truth for the cluster roles.
  if (cluster && topology && topology.nodes.length > 0) {
    const union = topologySelection(topology, cluster.roles);
    for (const role of cluster.roles) selection[role] = union[role];
    selected = selectedSlugs(selection);
  }

  const diagnostics: Diagnostic[] = [];
  const recommended = new Set<string>();
  const hidden = new Set<string>(catalog.slots.filter(s => s.hidden_by_default).map(s => s.id));
  const requiredExtra = new Set<string>();
  const many = new Set<string>();
  const restrictions = new Map<string, Array<(c: Component) => boolean>>();

  for (const rule of catalog.rules) {
    if (!ruleFires(rule, selection, selected)) continue;
    const t = rule.then;
    for (const s of t.open_slots ?? []) hidden.delete(s);
    for (const s of t.hide_slots ?? []) hidden.add(s);
    for (const s of t.require_slots ?? []) requiredExtra.add(s);
    for (const s of t.allow_many ?? []) many.add(s);
    for (const r of t.restrict ?? []) {
      const preds = restrictions.get(r.slot) ?? [];
      if (r.to) { const allow = new Set(r.to); preds.push(c => allow.has(c.slug)); }
      if (r.to_supporting) { const key = r.to_supporting; preds.push(c => !!c.supports?.[key]); }
      restrictions.set(r.slot, preds);
    }
    for (const s of t.recommend ?? []) if (!selected.has(s)) recommended.add(s);
    for (const s of t.require ?? []) if (!selected.has(s)) diagnostics.push({ level: 'error', rule: rule.id, message: `${bySlug.get(s)?.name ?? s} is required by this selection.` });
    for (const s of t.conflict ?? []) if (selected.has(s)) diagnostics.push({ level: 'error', rule: rule.id, message: `${bySlug.get(s)?.name ?? s} conflicts with this selection.` });
    // Rule `warn` texts are operator guidance, shown as notes; real problems come from require/conflict/topology.
    if (t.warn) diagnostics.push({ level: 'info', rule: rule.id, message: t.warn });
  }

  // A CL with embeds:[validator] covers the VC slot when no standalone VC is picked.
  const validatorEmbedded = (selection.consensus ?? []).some(s => bySlug.get(s)?.embeds?.includes('validator'));
  const clusterRoles = new Set<string>(cluster?.roles ?? []);

  const slots: SlotView[] = [...catalog.slots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(slot => {
    const visible = !hidden.has(slot.id);
    const required = (slot.required || requiredExtra.has(slot.id)) && visible;
    const cardinality: 'one' | 'many' = many.has(slot.id) ? 'many' : slot.cardinality;
    let options = slot.id === 'network'
      ? []
      : catalog.components.filter(c => c.roles.includes(slot.role) && c.status !== 'archived');
    if (slot.include_tag) options = options.filter(c => c.tags?.includes(slot.include_tag!));
    if (slot.exclude_tag) options = options.filter(c => !c.tags?.includes(slot.exclude_tag!));
    for (const pred of restrictions.get(slot.id) ?? []) options = options.filter(pred);
    const sel = selection[slot.id] ?? [];
    const managedByCluster = !!cluster && clusterRoles.has(slot.id);

    if (visible && required && sel.length === 0 && !(slot.id === 'validator' && validatorEmbedded) && !managedByCluster) {
      diagnostics.push({ level: 'error', slot: slot.id, message: `${slot.label} is required.` });
    }
    if (cardinality === 'one' && sel.length > 1) diagnostics.push({ level: 'error', slot: slot.id, message: `${slot.label} accepts one selection.` });
    if (visible) {
      for (const s of sel) {
        if (slot.id === 'network') continue;
        if (!options.some(o => o.slug === s)) diagnostics.push({ level: 'error', slot: slot.id, message: `${bySlug.get(s)?.name ?? s} is not allowed in ${slot.label} with the current selection.` });
      }
    }
    return { slot, visible, required, cardinality, options, selected: visible ? sel : [], managedByCluster };
  });

  // Cluster analysis: per-node completeness and client diversity vs fault tolerance.
  let topo: TopologyAnalysis | null = null;
  if (cluster) {
    const nodes = topology?.nodes ?? [];
    if (nodes.length === 0) {
      diagnostics.push({ level: 'error', message: 'Define the cluster nodes: pick EL/CL clients per node.' });
    } else {
      topo = analyzeTopology(catalog, { nodes, threshold: topology?.threshold }, cluster);
      for (const d of topo.diagnostics) diagnostics.push({ level: d.level, node: d.node, slot: d.role, message: d.message });
    }
  }

  // Network coverage: components that do not list a chosen network.
  const networks = selection.network ?? [];
  const visibleSelected = new Set(slots.filter(s => s.visible && s.slot.id !== 'network').flatMap(s => s.selected));
  for (const slug of visibleSelected) {
    const c = bySlug.get(slug);
    if (!c?.networks) continue;
    for (const n of networks) if (!c.networks.includes(n)) diagnostics.push({ level: 'warn', message: `${c.name} does not list ${n} as a supported network.` });
  }
  if (networks.length === 0) diagnostics.push({ level: 'error', slot: 'network', message: 'Pick at least one network.' });
  else if (!networks.some(n => n !== 'mainnet')) {
    diagnostics.push({ level: 'info', message: 'No testnet selected. Forks activate on Sepolia and Hoodi first; add Hoodi to rehearse upgrades.' });
  }

  return {
    slots,
    diagnostics: dedupe(diagnostics),
    recommended: [...recommended],
    effectiveComponents: [...visibleSelected],
    networks,
    cluster,
    topology: topo,
    selection,
  };
}

function dedupe(d: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return d.filter(x => { const k = `${x.level}|${x.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export type { ClusterRole };

import type { Catalog, Component, Rule, Slot, StackSelection } from './types';

export interface SlotView {
  slot: Slot;
  visible: boolean;
  required: boolean;
  options: Component[];          // after restrictions
  selected: string[];
}
export interface Diagnostic { level: 'error' | 'warn' | 'info'; rule?: string; slot?: string; message: string }
export interface ComposeResult {
  slots: SlotView[];
  diagnostics: Diagnostic[];
  recommended: string[];
  /** Every component slug in the stack, including those that embed other roles. Used for the timeline query. */
  effectiveComponents: string[];
  networks: string[];
}

function selectedSlugs(sel: StackSelection): Set<string> {
  const out = new Set<string>();
  for (const [slot, slugs] of Object.entries(sel)) if (slot !== 'network') for (const s of slugs) out.add(s);
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
 * Pure function: given the catalog and a selection, compute what the builder
 * should show and which problems the selection has. The web UI and the
 * readiness engine both call this, so rules live in exactly one place.
 */
export function compose(catalog: Catalog, selection: StackSelection): ComposeResult {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const selected = selectedSlugs(selection);
  const diagnostics: Diagnostic[] = [];
  const recommended = new Set<string>();
  const hidden = new Set<string>(catalog.slots.filter(s => s.hidden_by_default).map(s => s.id));
  const requiredExtra = new Set<string>();
  const restrictions = new Map<string, Array<(c: Component) => boolean>>();

  for (const rule of catalog.rules) {
    if (!ruleFires(rule, selection, selected)) continue;
    const t = rule.then;
    for (const s of t.open_slots ?? []) hidden.delete(s);
    for (const s of t.hide_slots ?? []) hidden.add(s);
    for (const s of t.require_slots ?? []) requiredExtra.add(s);
    for (const r of t.restrict ?? []) {
      const preds = restrictions.get(r.slot) ?? [];
      if (r.to) { const allow = new Set(r.to); preds.push(c => allow.has(c.slug)); }
      if (r.to_supporting) { const key = r.to_supporting; preds.push(c => !!c.supports?.[key]); }
      restrictions.set(r.slot, preds);
    }
    for (const s of t.recommend ?? []) if (!selected.has(s)) recommended.add(s);
    for (const s of t.require ?? []) if (!selected.has(s)) diagnostics.push({ level: 'error', rule: rule.id, message: `${bySlug.get(s)?.name ?? s} is required by this selection.` });
    for (const s of t.conflict ?? []) if (selected.has(s)) diagnostics.push({ level: 'error', rule: rule.id, message: `${bySlug.get(s)?.name ?? s} conflicts with this selection.` });
    if (t.warn) diagnostics.push({ level: 'warn', rule: rule.id, message: t.warn });
  }

  // Embedded roles: a CL with embeds:[validator] satisfies the validator slot when the same slug is chosen for both,
  // or when the validator slot is empty and the CL embeds it.
  const consensus = selection.consensus?.[0];
  const consensusComp = consensus ? bySlug.get(consensus) : undefined;
  const validatorEmbedded = !!consensusComp?.embeds?.includes('validator');

  const slots: SlotView[] = [...catalog.slots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(slot => {
    const visible = !hidden.has(slot.id);
    const required = (slot.required || requiredExtra.has(slot.id)) && visible;
    let options = slot.id === 'network'
      ? []
      : catalog.components.filter(c => c.roles.includes(slot.role) && c.status !== 'archived');
    for (const pred of restrictions.get(slot.id) ?? []) options = options.filter(pred);
    const sel = selection[slot.id] ?? [];
    if (visible && required && sel.length === 0 && !(slot.id === 'validator' && validatorEmbedded)) {
      diagnostics.push({ level: 'error', slot: slot.id, message: `${slot.label} is required.` });
    }
    if (slot.cardinality === 'one' && sel.length > 1) diagnostics.push({ level: 'error', slot: slot.id, message: `${slot.label} accepts one selection.` });
    for (const s of sel) {
      if (slot.id === 'network') continue;
      if (!options.some(o => o.slug === s)) diagnostics.push({ level: 'error', slot: slot.id, message: `${bySlug.get(s)?.name ?? s} is not allowed in ${slot.label} with the current selection.` });
    }
    return { slot, visible, required, options, selected: sel };
  });

  // Network coverage: components that do not list the chosen network.
  const networks = selection.network ?? [];
  for (const slug of selected) {
    const c = bySlug.get(slug);
    if (!c?.networks) continue;
    for (const n of networks) if (!c.networks.includes(n)) diagnostics.push({ level: 'warn', message: `${c.name} does not list ${n} as a supported network.` });
  }
  if (networks.length > 0 && !networks.some(n => n !== 'mainnet')) {
    diagnostics.push({ level: 'info', message: 'No testnet selected. Forks activate on sepolia and hoodi first; add one to rehearse upgrades.' });
  }

  const effective = new Set(selected);
  if (validatorEmbedded && consensus) effective.add(consensus);
  return { slots, diagnostics, recommended: [...recommended], effectiveComponents: [...effective], networks };
}

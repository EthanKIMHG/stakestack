'use client';
import { useState } from 'react';
import { Check, CircleCheck, WandSparkles } from 'lucide-react';
import type { Preset } from '@stakestack/shared/presets';
import type { ClusterNode, Component, StackSelection } from '@stakestack/shared/types';
import { Logo } from '../Logo';
import { ROLE_SHORT, slotShort } from './meta';

const ROLES = ['execution', 'consensus', 'validator'] as const;

/** Same picks, ignoring empty slots and node labels. */
export function presetMatches(p: Preset, sel: StackSelection, nodes: ClusterNode[]): boolean {
  const keys = new Set([...Object.keys(p.selection), ...Object.keys(sel)]);
  for (const k of keys) {
    const a = [...(p.selection[k] ?? [])].sort().join();
    const b = [...(sel[k] ?? [])].sort().join();
    if (a !== b) return false;
  }
  const pn = p.topology?.nodes ?? [];
  if (pn.length !== nodes.length) return false;
  return pn.every((n, i) => ROLES.every(r => (n[r] ?? '') === (nodes[i]?.[r] ?? '')));
}

/** Logos that identify a template at a glance: the DVT middleware or the EL/CL pair, then the rest. */
function headline(p: Preset): string[] {
  const nodes = p.topology?.nodes ?? [];
  const core = p.selection.dvt?.length
    ? [...p.selection.dvt, ...nodes.flatMap(n => [n.execution, n.consensus])]
    : [...(p.selection.execution ?? []), ...(p.selection.consensus ?? [])];
  const rest = [...(p.selection.protocol ?? []), ...(p.selection.mev ?? []), ...(p.selection['remote-signer'] ?? [])];
  return [...new Set([...core, ...rest].filter((s): s is string => !!s))];
}

export function TemplatePicker({ presets, bySlug, sel, nodes, onApply }: {
  presets: Preset[];
  bySlug: Map<string, Component>;
  sel: StackSelection;
  nodes: ClusterNode[];
  onApply: (p: Preset) => void;
}) {
  const applied = presets.find(p => presetMatches(p, sel, nodes))?.id ?? null;
  const [focus, setFocus] = useState<string | null>(null);
  const shown = presets.find(p => p.id === (focus ?? applied)) ?? null;

  return (
    <div className="step-body">
      <div className="template-grid" role="group" aria-label="Templates">
        {presets.map(p => {
          const logos = headline(p).slice(0, 4);
          return (
            <button key={p.id} type="button" className="template" aria-pressed={shown?.id === p.id} onClick={() => setFocus(p.id)}>
              <span className="template-name">{p.name}{applied === p.id && <CircleCheck aria-label="Applied" />}</span>
              <span className="logo-stack">
                {logos.map(s => { const c = bySlug.get(s); return <Logo key={s} logo={c?.logo} name={c?.name ?? s} size={24} />; })}
              </span>
            </button>
          );
        })}
      </div>
      {shown && <TemplateDetail p={shown} bySlug={bySlug} applied={applied === shown.id} onApply={() => { onApply(shown); setFocus(null); }} />}
    </div>
  );
}

function TemplateDetail({ p, bySlug, applied, onApply }: { p: Preset; bySlug: Map<string, Component>; applied: boolean; onApply: () => void }) {
  const nodes = p.topology?.nodes ?? [];
  const items: Array<{ slug: string; role: string }> = [];
  for (const [slot, slugs] of Object.entries(p.selection)) {
    if (slot === 'network') continue;
    for (const s of slugs) items.push({ slug: s, role: ROLE_SHORT[slot] ?? slotShort(slot, slot) });
  }
  // Single node: the VC is usually the CL's own; say it once.
  const vcSame = (p.selection.validator?.[0] ?? '') === (p.selection.consensus?.[0] ?? '-');
  const list = items.filter(i => !(vcSame && i.role === 'VC'));
  return (
    <div className="template-detail" aria-live="polite">
      <div>
        <div className="h3">{p.name}</div>
        <p style={{ marginTop: 2 }}>{p.blurb}</p>
        <div className="template-items">
          {list.map(i => {
            const c = bySlug.get(i.slug);
            return <span key={`${i.role}-${i.slug}`} className="chip-logo"><Logo logo={c?.logo} name={c?.name ?? i.slug} size={20} />{c?.name ?? i.slug}<span className="role">{vcSame && i.role === 'CL' ? 'CL+VC' : i.role}</span></span>;
          })}
          {nodes.length > 0 && <span className="chip-logo" style={{ paddingLeft: 10 }}>{nodes.length} node{nodes.length > 1 ? 's' : ''}<span className="role">{[...new Set(nodes.map(n => n.execution))].length} EL · {[...new Set(nodes.map(n => n.consensus))].length} CL</span></span>}
        </div>
      </div>
      {applied
        ? <span className="pill pill-ok" style={{ height: 32, padding: '0 12px' }}><Check aria-hidden />Applied</span>
        : <button type="button" className="btn btn-primary btn-sm" onClick={onApply}><WandSparkles aria-hidden />Use template</button>}
    </div>
  );
}

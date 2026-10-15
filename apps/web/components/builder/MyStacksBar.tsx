'use client';
import { Layers, Plus, RotateCw, Trash2 } from 'lucide-react';
import type { Component } from '@stakestack/shared/types';
import type { MyStack, MyStacksState } from '../auth/myStacks';
import { Logo } from '../Logo';
import { relative } from '@/lib/format';

/** The logos that identify a stack: DVT middleware or EL/CL, then a couple of add-ons. */
function headline(s: MyStack): string[] {
  const sel = s.selection ?? {};
  const nodes = s.topology?.nodes ?? [];
  const core = sel.dvt?.length ? [...sel.dvt, ...nodes.flatMap(n => [n.execution, n.consensus])] : [...(sel.execution ?? []), ...(sel.consensus ?? [])];
  const rest = [...(sel.protocol ?? []), ...(sel.mev ?? []), ...(sel['remote-signer'] ?? [])];
  return [...new Set([...core, ...rest].filter((x): x is string => !!x))].slice(0, 4);
}

/** Members' saved stacks above the builder: pick one to edit, or start a new one. */
export function MyStacksBar({ stacks, status, error, currentId, dirty, bySlug, onOpen, onNew, onDelete, onRetry }: {
  stacks: MyStack[];
  status: MyStacksState['status'];
  error?: string;
  currentId: string | null;
  dirty: boolean;
  bySlug: Map<string, Component>;
  onOpen: (s: MyStack) => void;
  onNew: () => void;
  onDelete: (s: MyStack) => void;
  onRetry: () => void;
}) {
  return (
    <section className="card mystacks" id="my-stacks" aria-label="My stacks">
      <div className="mystacks-head">
        <span className="h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Layers aria-hidden width={16} height={16} />My stacks</span>
        {status === 'ready' && <span className="pill pill-sm">{stacks.length}</span>}
        <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={onNew}><Plus aria-hidden />New stack</button>
      </div>
      <div className="mystacks-row">
        {status === 'loading' && [0, 1, 2].map(i => <span key={i} className="mystack mystack-skel" aria-hidden />)}
        {status === 'error' && (
          <div className="mystacks-empty">
            Could not load your stacks{error ? `: ${error}` : ''}.
            <button type="button" className="btn btn-xs" onClick={onRetry}><RotateCw aria-hidden />Retry</button>
          </div>
        )}
        {status === 'ready' && stacks.length === 0 && <div className="mystacks-empty">No saved stacks yet. Build one below and save it to your account.</div>}
        {stacks.map(s => {
          const on = s.id === currentId;
          const count = Object.entries(s.selection ?? {}).filter(([k]) => k !== 'network').reduce((n, [, v]) => n + (v?.length ?? 0), 0);
          return (
            <div key={s.id} className="mystack-wrap">
              <button type="button" className="mystack" aria-pressed={on} onClick={() => onOpen(s)} title={s.name}>
                <span className="mystack-name">{s.name}{on && dirty && <span className="mystack-dirty" title="Unsaved changes" aria-label="unsaved changes" />}</span>
                <span className="logo-stack">{headline(s).map(x => { const c = bySlug.get(x); return <Logo key={x} logo={c?.logo} name={c?.name ?? x} size={22} />; })}</span>
                <span className="meta">{count} items · {relative(s.updated_at) || 'just now'}</span>
              </button>
              {on && <button type="button" className="icon-btn icon-btn-sm mystack-del" aria-label={`Delete ${s.name}`} onClick={() => onDelete(s)}><Trash2 aria-hidden /></button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

'use client';
import type { Component } from '@stakestack/shared/types';

export function matches(c: Component, q: string): boolean {
  if (!q) return true;
  const hay = `${c.name} ${c.vendor ?? ''} ${c.slug} ${(c.tags ?? []).join(' ')} ${c.summary ?? ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
}

export function OptionGrid({ options, selected, onToggle, recommended, query = '', builtIn, emptyText = 'No matching components.' }: {
  options: Component[];
  selected: string[];
  onToggle: (slug: string) => void;
  recommended?: Set<string>;
  query?: string;
  /** Slug that is the "built-in" choice (e.g. the VC embedded in the selected CL). */
  builtIn?: string;
  emptyText?: string;
}) {
  const shown = options.filter(o => matches(o, query) || selected.includes(o.slug));
  if (shown.length === 0) return <p className="faint" style={{ fontSize: 13 }}>{emptyText}</p>;
  return (
    <div className="opt-grid">
      {shown.map(o => {
        const on = selected.includes(o.slug);
        return (
          <button key={o.slug} type="button" className={`opt ${o.status === 'deprecated' ? 'dim' : ''}`} aria-pressed={on} onClick={() => onToggle(o.slug)} title={o.summary}>
            <span className="name">{o.name}</span>
            <span className="meta">{[o.vendor, o.language].filter(Boolean).join(' · ')}</span>
            {(builtIn === o.slug || recommended?.has(o.slug) || o.status !== 'active') && (
              <span className="badges">
                {builtIn === o.slug && <span className="chip chip-ok">Built into CL</span>}
                {recommended?.has(o.slug) && <span className="chip chip-accent">Recommended</span>}
                {o.status !== 'active' && <span className={`chip ${o.status === 'deprecated' ? 'chip-warn' : ''}`}>{o.status}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

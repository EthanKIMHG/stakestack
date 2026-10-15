'use client';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ExternalLink, Globe, Info, Plus, Star, UserRound } from 'lucide-react';
import type { Component } from '@stakestack/shared/types';
import { Logo } from '../Logo';
import { GitHubIcon } from '../icons';

export function matches(c: Component, q: string): boolean {
  if (!q) return true;
  const hay = `${c.name} ${c.vendor ?? ''} ${c.slug} ${(c.tags ?? []).join(' ')} ${c.summary ?? ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
}

const STATUS_TONE: Record<string, string> = { deprecated: 'pill-flag', archived: 'pill-flag' };

/**
 * Product tiles: logo, name and vendor only. Everything else (summary, language, licence, links)
 * sits behind the info button so the grid stays scannable.
 */
export function ProductGrid({ options, selected, onToggle, recommended, query = '', builtIn, priority, emptyText = 'No matching components.' }: {
  options: Component[];
  selected: string[];
  onToggle: (slug: string) => void;
  recommended?: Set<string>;
  query?: string;
  /** The choice that is already covered by another pick (the VC built into the selected CL). */
  builtIn?: string;
  /** Members' own tools (from their saved stacks): listed first and tagged. */
  priority?: Set<string>;
  emptyText?: string;
}) {
  const [info, setInfo] = useState<string | null>(null);
  const filtered = options.filter(o => matches(o, query) || selected.includes(o.slug));
  const shown = priority?.size ? [...filtered.filter(o => priority.has(o.slug)), ...filtered.filter(o => !priority.has(o.slug))] : filtered;
  if (shown.length === 0) return <p className="meta">{emptyText}</p>;
  return (
    <div className="product-grid">
      {shown.map(o => (
        <ProductTile
          key={o.slug} c={o} on={selected.includes(o.slug)} onToggle={() => onToggle(o.slug)}
          recommended={!!recommended?.has(o.slug)} builtIn={builtIn === o.slug} yours={!!priority?.has(o.slug)}
          infoOpen={info === o.slug} onInfo={open => setInfo(open ? o.slug : null)}
        />
      ))}
    </div>
  );
}

function ProductTile({ c, on, onToggle, recommended, builtIn, yours, infoOpen, onInfo }: {
  c: Component; on: boolean; onToggle: () => void; recommended: boolean; builtIn: boolean; yours: boolean; infoOpen: boolean; onInfo: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [alignLeft, setAlignLeft] = useState(false);
  const openInfo = () => {
    // Right-aligned by default; flip when that would push the popover past the left edge.
    const r = ref.current?.getBoundingClientRect();
    if (r) setAlignLeft(r.right - 300 < 8);
    onInfo(!infoOpen);
  };
  useEffect(() => {
    if (!infoOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) onInfo(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [infoOpen, onInfo]);

  const tags = [
    builtIn && <span key="b" className="pill pill-ok pill-sm">Built into CL</span>,
    yours && !on && <span key="y" className="pill pill-sm pill-yours"><UserRound aria-hidden />Yours</span>,
    recommended && <span key="r" className="pill pill-accent pill-sm"><Star aria-hidden />Recommended</span>,
    c.status !== 'active' && <span key="s" className={`pill pill-sm ${STATUS_TONE[c.status] ?? ''}`}>{c.status}</span>,
  ].filter(Boolean);

  return (
    <div ref={ref} className={`product ${c.status === 'deprecated' ? 'dim' : ''}`}>
      <button type="button" className="product-btn" aria-pressed={on} onClick={onToggle}>
        <Logo logo={c.logo} name={c.name} size={40} />
        <span className="product-name" title={c.name}>{c.name}</span>
        <span className="product-meta">{c.vendor ?? c.repo.split('/')[0]}</span>
        {tags.length > 0 && <span className="product-tags">{tags}</span>}
      </button>
      <span className="product-pick" aria-hidden>{on ? <Check strokeWidth={3} /> : <Plus strokeWidth={2.5} />}</span>
      <button type="button" className="icon-btn icon-btn-sm product-info" aria-label={`About ${c.name}`} aria-expanded={infoOpen} onClick={openInfo}>
        <Info aria-hidden />
      </button>
      {infoOpen && (
        <div className={`popover product-popover ${alignLeft ? 'align-left' : ''}`} role="dialog" aria-label={c.name}>
          <div className="popover-title"><Logo logo={c.logo} name={c.name} size={28} />{c.name}</div>
          {c.summary && <p style={{ marginTop: 10 }}>{c.summary}</p>}
          <dl>
            {c.vendor && <><dt>Vendor</dt><dd>{c.vendor}</dd></>}
            {c.language && <><dt>Language</dt><dd>{c.language}</dd></>}
            {c.license && <><dt>License</dt><dd>{c.license}</dd></>}
            <dt>Status</dt><dd>{c.status}</dd>
          </dl>
          <div className="popover-links">
            <a href={`https://github.com/${c.repo}`} target="_blank" rel="noreferrer"><GitHubIcon size={12} />GitHub</a>
            {c.docs && <a href={c.docs} target="_blank" rel="noreferrer"><BookOpen aria-hidden />Docs</a>}
            {c.homepage && <a href={c.homepage} target="_blank" rel="noreferrer"><Globe aria-hidden />Website</a>}
            <a href={`/c/${c.slug}`}><ExternalLink aria-hidden />Releases</a>
          </div>
        </div>
      )}
    </div>
  );
}

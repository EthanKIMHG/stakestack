'use client';
import { useMemo, useState } from 'react';
import { compose } from '@stakestack/shared/composer';
import type { Catalog, StackSelection } from '@stakestack/shared/types';

const DEFAULT: StackSelection = { network: ['hoodi', 'mainnet'], execution: ['nethermind'], consensus: ['lighthouse'], validator: ['lighthouse'] };

export function StackBuilder({ catalog, anonEnabled }: { catalog: Catalog; anonEnabled: boolean }) {
  const [sel, setSel] = useState<StackSelection>(DEFAULT);
  const [name, setName] = useState('My validator stack');
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const result = useMemo(() => compose(catalog, sel), [catalog, sel]);
  const errors = result.diagnostics.filter(d => d.level === 'error');

  function toggle(slotId: string, slug: string, one: boolean) {
    setSel(prev => {
      const cur = prev[slotId] ?? [];
      const next = one ? (cur[0] === slug ? [] : [slug]) : cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug];
      return { ...prev, [slotId]: next };
    });
  }

  async function save() {
    setSaving(true); setLink(null);
    const res = await fetch('/api/stacks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, selection: sel }) });
    const json = await res.json() as { slug?: string; error?: string };
    setSaving(false);
    if (json.slug) setLink(`/s/${json.slug}`); else alert(json.error ?? 'failed');
  }

  const encoded = typeof window !== 'undefined' ? `${window.location.origin}/s/preview?sel=${encodeURIComponent(JSON.stringify(sel))}` : '';

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-5">
        <div className="card">
          <h3 className="font-semibold">Networks <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>rollout order: {catalog.rollout_sequence.join(' → ')}</span></h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {catalog.networks.filter(n => !n.deprecated).map(n => (
              <button key={n.id} onClick={() => toggle('network', n.id, false)} className="rounded-md border px-3 py-1 text-sm" style={{ borderColor: sel.network?.includes(n.id) ? 'var(--accent)' : 'var(--line)' }}>{n.name}</button>
            ))}
          </div>
        </div>
        {result.slots.filter(s => s.visible && s.slot.id !== 'network').map(s => (
          <div key={s.slot.id} className="card">
            <h3 className="font-semibold">{s.slot.label}{s.required && <span style={{ color: 'var(--accent)' }}> *</span>}</h3>
            {s.slot.description && <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.slot.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {s.options.map(o => (
                <button key={o.slug} title={o.summary} onClick={() => toggle(s.slot.id, o.slug, s.slot.cardinality === 'one')} className="rounded-md border px-3 py-1 text-sm"
                  style={{ borderColor: s.selected.includes(o.slug) ? 'var(--accent)' : 'var(--line)', opacity: o.status === 'deprecated' ? 0.5 : 1 }}>
                  {o.name}{result.recommended.includes(o.slug) && <span className="ml-1 text-[10px]" style={{ color: 'var(--accent)' }}>rec</span>}
                </button>
              ))}
              {s.options.length === 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>no options for current selection</span>}
            </div>
          </div>
        ))}
      </div>
      <aside className="space-y-4">
        <div className="card">
          <h3 className="font-semibold">Diagnostics</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {result.diagnostics.map((d, i) => <li key={i} className={d.level === 'error' ? 'state-behind' : d.level === 'warn' ? 'state-update-available' : ''}>{d.level}: {d.message}</li>)}
            {result.diagnostics.length === 0 && <li style={{ color: 'var(--muted)' }}>no issues</li>}
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold">Save & share</h3>
          <input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full rounded-md border bg-transparent px-2 py-1 text-sm" style={{ borderColor: 'var(--line)' }} />
          <button disabled={!anonEnabled || saving || errors.length > 0} onClick={save} className="mt-2 w-full rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#052e16' }}>
            {saving ? 'saving…' : 'Create share link'}
          </button>
          {link && <p className="mt-2 text-xs">Saved: <a href={link}>{link}</a> · feed: <a href={`/api/feed/${link.split('/').pop()}.rss`}>RSS</a></p>}
          {!anonEnabled && <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Saving disabled (no database configured).</p>}
          {encoded && <p className="mt-2 text-xs"><a href={encoded}>Preview without saving</a></p>}
        </div>
        <details className="card text-xs"><summary>selection JSON</summary><pre className="mt-2 overflow-auto">{JSON.stringify(sel, null, 2)}</pre></details>
      </aside>
    </div>
  );
}

import { Layers } from 'lucide-react';
import type { Catalog, Topology } from '@stakestack/shared/types';
import type { ComposeResult } from '@stakestack/shared/composer';
import { ROLE_LABEL } from '@stakestack/shared/topology';
import { Diag, NetDot, Pill, StatusPill } from './ui';
import { Logo } from './Logo';
import { slotShort } from './builder/meta';

/** Read-only version of the builder's stack panel, used on saved stack pages. */
export function StackSummary({ catalog, result, topology }: { catalog: Catalog; result: ComposeResult; topology: Topology | null }) {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const nm = (s?: string) => (s ? bySlug.get(s)?.name ?? s : '—');
  const nodes = topology?.nodes ?? [];
  const rows = result.slots.filter(s => s.visible && s.slot.id !== 'network' && s.selected.length && !(result.cluster && s.managedByCluster));
  const issues = result.diagnostics.filter(d => d.level !== 'info' && !d.check);
  const checklist = result.diagnostics.filter(d => d.check);
  const errors = issues.filter(d => d.level === 'error').length;
  return (
    <aside className="card cart" aria-label="Composition">
      <div className="cart-head">
        <div className="cart-title"><Layers aria-hidden />Composition<StatusPill errors={errors} warnings={issues.length - errors} /></div>
      </div>
      <div className="cart-section">
        <div className="cart-label"><span className="eyebrow">Networks</span></div>
        <div className="cart-nets">{result.networks.map(n => <Pill key={n} className="pill-outline"><NetDot id={n} />{catalog.networks.find(x => x.id === n)?.name ?? n}</Pill>)}</div>
      </div>
      {result.cluster && nodes.length > 0 && (
        <div className="cart-section">
          <div className="cart-label">
            <span className="eyebrow">Cluster · {nm(result.selection.dvt?.[0])}</span>
            {result.topology && result.topology.n >= 3 && <span className="meta">{result.topology.threshold}/{result.topology.n} · tolerates {result.topology.tolerance}</span>}
          </div>
          <table className="mini-table">
            <thead><tr><th>Node</th>{result.cluster.roles.map(r => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>{nodes.map((n, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{n.label || `node-${i + 1}`}</td>
                {result.cluster!.roles.map(r => <td key={r} title={nm(n[r])}>{n[r] ? <span className="comp-cell"><Logo logo={bySlug.get(n[r]!)?.logo} name={nm(n[r])} size={18} /><span>{nm(n[r])}</span></span> : <span className="faint">—</span>}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="cart-section">
        <div className="cart-label"><span className="eyebrow">Components</span></div>
        <div className="cart-items">
          {rows.flatMap(s => s.selected.map(slug => (
            <a key={`${s.slot.id}-${slug}`} href={`/c/${slug}`} className="cart-item" style={{ color: 'inherit', textDecoration: 'none' }}>
              <Logo logo={bySlug.get(slug)?.logo} name={nm(slug)} size={30} />
              <span><b>{nm(slug)}</b><span className="meta">{slotShort(s.slot.id, s.slot.label)}</span></span>
              <span />
            </a>
          )))}
        </div>
      </div>
      {issues.length > 0 && (
        <div className="cart-section">
          <div className="cart-label"><span className="eyebrow">Checks</span></div>
          {issues.map((d, i) => <Diag key={i} level={d.level} source={d.source}>{d.message}</Diag>)}
        </div>
      )}
      {checklist.length > 0 && (
        <div className="cart-section">
          <div className="cart-label"><span className="eyebrow">Before you go live</span></div>
          {checklist.map((d, i) => <Diag key={i} level={d.level === 'warn' ? 'warn' : 'info'} source={d.source}>{d.message}</Diag>)}
        </div>
      )}
    </aside>
  );
}

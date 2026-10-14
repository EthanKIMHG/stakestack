import type { Catalog, Topology } from '@stakestack/shared/types';
import type { ComposeResult } from '@stakestack/shared/composer';
import { ROLE_LABEL } from '@stakestack/shared/topology';
import { Diag, NetDot } from './ui';

/** Read-only version of the builder's side panel, used on saved stack pages. */
export function StackSummary({ catalog, result, topology }: { catalog: Catalog; result: ComposeResult; topology: Topology | null }) {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const nm = (s?: string) => (s ? bySlug.get(s)?.name ?? s : '—');
  const nodes = topology?.nodes ?? [];
  const rows = result.slots.filter(s => s.visible && s.slot.id !== 'network' && s.selected.length && !(result.cluster && s.managedByCluster));
  const issues = result.diagnostics.filter(d => d.level !== 'info');
  return (
    <aside className="builder-aside">
      <div className="card">
        <div className="card-head"><h2>Composition</h2>{issues.length === 0 ? <span className="chip chip-ok">Valid</span> : <span className="chip chip-warn">{issues.length} note{issues.length > 1 ? 's' : ''}</span>}</div>
        <div className="panel-section">
          <div className="panel-label">Networks</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{result.networks.map(n => <span key={n} className="sel-chip static"><NetDot id={n} />&nbsp;{catalog.networks.find(x => x.id === n)?.name ?? n}</span>)}</div>
        </div>
        {result.cluster && nodes.length > 0 && (
          <div className="panel-section">
            <div className="panel-label">Cluster · {nm(result.selection.dvt?.[0])}{result.topology && result.topology.n >= 3 && <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>{result.topology.threshold}/{result.topology.n} · tolerates {result.topology.tolerance}</span>}</div>
            <table className="mini-table">
              <thead><tr><th>Node</th>{result.cluster.roles.map(r => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
              <tbody>{nodes.map((n, i) => <tr key={i}><td className="node-name">{n.label || `node-${i + 1}`}</td>{result.cluster!.roles.map(r => <td key={r} title={nm(n[r])}>{nm(n[r])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="panel-section">
          <div className="panel-label">Components</div>
          <dl className="kv">
            {rows.map(s => (
              <div key={s.slot.id} style={{ display: 'contents' }}>
                <dt>{s.slot.label.replace(/ \(.+\)$/, '')}</dt>
                <dd>{s.selected.map(slug => <a key={slug} href={`/c/${slug}`} className="sel-chip static" style={{ color: 'var(--text)' }}>{nm(slug)}</a>)}</dd>
              </div>
            ))}
          </dl>
        </div>
        {issues.length > 0 && (
          <div className="panel-section">
            <div className="panel-label">Checks</div>
            {issues.map((d, i) => <Diag key={i} level={d.level}>{d.message}</Diag>)}
          </div>
        )}
      </div>
    </aside>
  );
}

'use client';
import type { ClusterNode, ClusterRole, ClusterSpec, Component } from '@stakestack/shared/types';
import { ROLE_LABEL, clusterThreshold, faultTolerance, resize, type TopologyAnalysis } from '@stakestack/shared/topology';
import { Diag } from '../ui';

const PALETTE = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed', '#0d9488', '#ea580c'];

export function ClusterEditor({ spec, nodes, onChange, allowed, analysis, middleware, onDiversify }: {
  spec: ClusterSpec;
  nodes: ClusterNode[];
  onChange: (nodes: ClusterNode[]) => void;
  allowed: Record<ClusterRole, Component[]>;
  analysis: TopologyAnalysis | null;
  middleware: string;
  onDiversify: (n: number) => void;
}) {
  const n = nodes.length;
  const threshold = clusterThreshold(n);
  const tolerance = faultTolerance(n);
  const bySlug = new Map(Object.values(allowed).flat().map(c => [c.slug, c]));

  const setNode = (i: number, patch: Partial<ClusterNode>) => {
    onChange(nodes.map((node, k) => {
      if (k !== i) return node;
      const next = { ...node, ...patch };
      // Keep the VC on the node's CL when the CL has a built-in VC and the VC was following the old CL.
      if (patch.consensus !== undefined && spec.roles.includes('validator')) {
        const followed = !node.validator || node.validator === node.consensus;
        const cl = bySlug.get(patch.consensus ?? '');
        if (followed) next.validator = cl?.embeds?.includes('validator') && allowed.validator.some(v => v.slug === cl.slug) ? cl.slug : node.validator === node.consensus ? undefined : node.validator;
      }
      return next;
    }));
  };
  const copyFirst = () => onChange(nodes.map((node, i) => (i === 0 ? node : { ...nodes[0]!, label: node.label })));

  return (
    <div>
      <div className="cluster-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Nodes</span>
          <div className="stepper">
            <button type="button" aria-label="Remove node" onClick={() => n > 1 && onChange(resize(nodes, n - 1))}>−</button>
            <span>{n}</span>
            <button type="button" aria-label="Add node" onClick={() => n < 10 && onChange(resize(nodes, n + 1))}>+</button>
          </div>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {n >= 3 ? <>Signs with <b>{threshold} of {n}</b> · tolerates <b>{tolerance}</b> offline</> : <>{middleware} {n === 1 ? 'single operator node' : `${n} nodes`}</>}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={() => onDiversify(n)} title="Assign a different EL/CL pair to every node">Auto-diversify</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={copyFirst} disabled={n < 2} title="Copy node 1's clients to every node">Same as node 1</button>
        </div>
      </div>

      <div className="scroll-x">
        <table className="node-table">
          <thead>
            <tr><th style={{ width: 160 }}>Node</th>{spec.roles.map(r => <th key={r}>{ROLE_LABEL[r]} · {r}</th>)}</tr>
          </thead>
          <tbody>
            {nodes.map((node, i) => (
              <tr key={i}>
                <td>
                  <input className="input" style={{ height: 32, fontSize: 13 }} value={node.label ?? ''} placeholder={`node-${i + 1}`} aria-label={`Node ${i + 1} name`}
                    onChange={e => setNode(i, { label: e.target.value })} />
                </td>
                {spec.roles.map(role => (
                  <td key={role}>
                    <select className={`select ${node[role] ? '' : 'missing'}`} value={node[role] ?? ''} aria-label={`Node ${i + 1} ${role} client`}
                      onChange={e => setNode(i, { [role]: e.target.value || undefined })}>
                      <option value="">Choose {ROLE_LABEL[role]}…</option>
                      {allowed[role].map(c => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}{role === 'validator' && c.slug === node.consensus ? ' (built-in)' : ''}{c.status !== 'active' ? ` · ${c.status}` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analysis && n >= 2 && (
        <div className="share-bars">
          {spec.roles.map(role => {
            const shares = analysis.shares[role] ?? [];
            return (
              <div key={role} className="share-row">
                <b className="faint">{ROLE_LABEL[role]}</b>
                <div className="share-track" role="img" aria-label={`${role} distribution`}>
                  {shares.map((s, k) => (
                    <div key={s.slug} className={`share-seg ${s.overTolerance ? 'over' : ''}`} style={{ flex: s.nodes.length, background: PALETTE[k % PALETTE.length] }} title={`${s.name}: nodes ${s.nodes.map(x => x + 1).join(', ')}`}>
                      {s.name} ×{s.nodes.length}
                    </div>
                  ))}
                  {shares.length === 0 && <div className="faint" style={{ padding: '0 8px', fontSize: 11 }}>not set</div>}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 4 }}>
            {analysis.diagnostics.filter(d => d.level !== 'error').map((d, i) => <Diag key={i} level={d.level}>{d.message}</Diag>)}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { Copy, Minus, Plus, Shuffle } from 'lucide-react';
import type { ClusterNode, ClusterRole, ClusterSpec, Component } from '@stakestack/shared/types';
import { ROLE_LABEL, clusterThreshold, faultTolerance, resize, type TopologyAnalysis } from '@stakestack/shared/topology';
import { Diag } from '../ui';
import { Logo } from '../Logo';

const PALETTE = ['#3d5bd9', '#0e8fb0', '#13946b', '#c27c14', '#d4407f', '#7c5cf6', '#0d9488', '#bf5a17'];

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
          <span className="h3">Nodes</span>
          <div className="stepper">
            <button type="button" aria-label="Remove node" onClick={() => n > 1 && onChange(resize(nodes, n - 1))}><Minus aria-hidden /></button>
            <span aria-live="polite">{n}</span>
            <button type="button" aria-label="Add node" onClick={() => n < 10 && onChange(resize(nodes, n + 1))}><Plus aria-hidden /></button>
          </div>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {n >= 3 ? <><b>{threshold} of {n}</b> sign · <b>{tolerance}</b> can be offline</> : <>{middleware} · {n === 1 ? 'single node' : `${n} nodes`}</>}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={() => onDiversify(n)} title="A different EL/CL pair on every node"><Shuffle aria-hidden />Diversify</button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={copyFirst} disabled={n < 2} title="Copy node 1's clients to every node"><Copy aria-hidden />Same as node 1</button>
        </div>
      </div>

      <div className="scroll-x">
        <table className="node-table">
          <thead>
            <tr><th style={{ width: 150 }}>Node</th>{spec.roles.map(r => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr>
          </thead>
          <tbody>
            {nodes.map((node, i) => (
              <tr key={i}>
                <td>
                  <input className="field field-sm" value={node.label ?? ''} placeholder={`node-${i + 1}`} aria-label={`Node ${i + 1} name`}
                    onChange={e => setNode(i, { label: e.target.value })} />
                </td>
                {spec.roles.map(role => {
                  const c = node[role] ? bySlug.get(node[role]!) : undefined;
                  return (
                    <td key={role}>
                      <div className="node-cell">
                        <Logo logo={c?.logo} name={c?.name ?? '?'} size={26} />
                        <select className={`field field-sm ${node[role] ? '' : 'missing'}`} value={node[role] ?? ''} aria-label={`Node ${i + 1} ${role} client`}
                          onChange={e => setNode(i, { [role]: e.target.value || undefined })}>
                          <option value="">Choose {ROLE_LABEL[role]}…</option>
                          {allowed[role].map(o => (
                            <option key={o.slug} value={o.slug}>
                              {o.name}{role === 'validator' && o.slug === node.consensus ? ' (built-in)' : ''}{o.status !== 'active' ? ` · ${o.status}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  );
                })}
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
                  {shares.length === 0 && <div className="faint" style={{ padding: '0 8px', fontSize: 11, alignSelf: 'center' }}>not set</div>}
                </div>
              </div>
            );
          })}
          {analysis.diagnostics.some(d => d.level !== 'error') && (
            <div style={{ marginTop: 4 }}>
              {analysis.diagnostics.filter(d => d.level !== 'error').map((d, i) => <Diag key={i} level={d.level}>{d.message}</Diag>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

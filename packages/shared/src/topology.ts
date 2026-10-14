import type { Catalog, ClusterNode, ClusterRole, ClusterSpec, Component, Topology } from './types';

/**
 * DVT cluster helpers.
 *
 * A distributed validator cluster of n nodes signs when `threshold` nodes agree.
 * Obol Charon defaults to ceil(2n/3) (4 nodes -> 3, 7 -> 5, 10 -> 7), which is
 * also the usual SSV operator threshold. The cluster tolerates n - threshold
 * nodes being offline. A bug in one client takes down every node that runs it,
 * so no single client should run on more nodes than the cluster can lose.
 */
export function clusterThreshold(n: number): number {
  return Math.max(1, Math.ceil((2 * n) / 3));
}

export function faultTolerance(n: number, threshold = clusterThreshold(n)): number {
  return Math.max(0, n - threshold);
}

export const ROLE_LABEL: Record<ClusterRole, string> = { execution: 'EL', consensus: 'CL', validator: 'VC' };

/** Union of clients per role across nodes, in first-seen order. Feeds the flat stack selection. */
export function topologySelection(t: Topology, roles: ClusterRole[]): Record<ClusterRole, string[]> {
  const out: Record<ClusterRole, string[]> = { execution: [], consensus: [], validator: [] };
  for (const node of t.nodes) {
    for (const role of roles) {
      const slug = node[role];
      if (slug && !out[role].includes(slug)) out[role].push(slug);
    }
  }
  return out;
}

export interface ClientShare { slug: string; name: string; nodes: number[]; overTolerance: boolean }
export interface TopologyDiagnostic { level: 'error' | 'warn' | 'info'; message: string; node?: number; role?: ClusterRole }
export interface TopologyAnalysis {
  n: number;
  threshold: number;
  tolerance: number;
  shares: Record<ClusterRole, ClientShare[]>;
  diagnostics: TopologyDiagnostic[];
  /** True when every role has every node filled and no client exceeds the fault tolerance. */
  healthy: boolean;
}

export function analyzeTopology(catalog: Catalog, t: Topology, spec: ClusterSpec): TopologyAnalysis {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const n = t.nodes.length;
  const threshold = t.threshold ?? clusterThreshold(n);
  const tolerance = faultTolerance(n, threshold);
  const diagnostics: TopologyDiagnostic[] = [];
  const shares = { execution: [], consensus: [], validator: [] } as Record<ClusterRole, ClientShare[]>;

  if (n === 0) {
    diagnostics.push({ level: 'error', message: 'Add at least one node to the cluster.' });
    return { n, threshold, tolerance, shares, diagnostics, healthy: false };
  }
  if (threshold > n) diagnostics.push({ level: 'error', message: `Threshold ${threshold} is larger than the ${n} nodes in the cluster.` });

  t.nodes.forEach((node, i) => {
    for (const role of spec.roles) {
      if (!node[role]) diagnostics.push({ level: 'error', node: i, role, message: `Node ${i + 1}: choose a ${ROLE_LABEL[role]} client.` });
    }
  });

  for (const role of spec.roles) {
    const map = new Map<string, number[]>();
    t.nodes.forEach((node, i) => { const s = node[role]; if (s) map.set(s, [...(map.get(s) ?? []), i]); });
    shares[role] = [...map.entries()]
      .map(([slug, nodes]) => ({ slug, name: bySlug.get(slug)?.name ?? slug, nodes, overTolerance: n >= 3 && nodes.length > tolerance }))
      .sort((a, b) => b.nodes.length - a.nodes.length);

    if (n < 3) continue;
    for (const share of shares[role]) {
      if (!share.overTolerance) continue;
      const all = share.nodes.length === n;
      diagnostics.push({
        level: 'warn', role,
        message: all
          ? `Every node runs ${share.name} (${ROLE_LABEL[role]}). One ${share.name} bug stops the whole cluster.`
          : `${share.name} (${ROLE_LABEL[role]}) runs on ${share.nodes.length} of ${n} nodes. The cluster needs ${threshold} online, so it tolerates only ${tolerance} failing node${tolerance === 1 ? '' : 's'}.`,
      });
    }
  }

  const errors = diagnostics.some(d => d.level === 'error');
  const overs = diagnostics.some(d => d.level === 'warn');
  if (n >= 3 && !errors && !overs) {
    diagnostics.push({ level: 'info', message: `Client diversity OK: no single client runs on more than ${tolerance} of ${n} nodes (threshold ${threshold}).` });
  }
  return { n, threshold, tolerance, shares, diagnostics, healthy: !errors && !overs };
}

/** Preferred order when auto-assigning. Minority clients are spread first so the result is diverse by default. */
const PREFERRED: Record<ClusterRole, string[]> = {
  execution: ['nethermind', 'geth', 'besu', 'reth', 'erigon', 'ethrex'],
  consensus: ['lighthouse', 'teku', 'nimbus-eth2', 'lodestar', 'prysm', 'grandine'],
  validator: ['lighthouse', 'teku', 'nimbus-eth2', 'lodestar', 'prysm', 'vouch', 'vero'],
};

export interface DiversifyOptions {
  /** Allowed slugs per role, typically the composer's slot options (already restricted by rules such as Charon support). */
  allowed: Partial<Record<ClusterRole, string[]>>;
}

/**
 * Assign clients round-robin so that no client repeats until every allowed
 * client has been used once. When the CL embeds a VC that is allowed, the VC
 * follows the CL (the common way to run Charon nodes).
 */
export function diversify(catalog: Catalog, n: number, roles: ClusterRole[], opts: DiversifyOptions): ClusterNode[] {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const pool = (role: ClusterRole): string[] => {
    const allowed = new Set(opts.allowed[role] ?? []);
    const preferred = PREFERRED[role].filter(s => allowed.has(s) && isUsable(bySlug.get(s)));
    const rest = [...allowed].filter(s => !preferred.includes(s) && isUsable(bySlug.get(s)));
    return [...preferred, ...rest];
  };
  const el = pool('execution');
  const cl = pool('consensus');
  const vc = pool('validator');
  const vcAllowed = new Set(vc);

  return Array.from({ length: n }, (_, i) => {
    const node: ClusterNode = { label: `node-${i + 1}` };
    if (roles.includes('execution') && el.length) node.execution = el[i % el.length];
    if (roles.includes('consensus') && cl.length) node.consensus = cl[i % cl.length];
    if (roles.includes('validator')) {
      const c = node.consensus ? bySlug.get(node.consensus) : undefined;
      node.validator = c?.embeds?.includes('validator') && vcAllowed.has(c.slug) ? c.slug : vc.length ? vc[i % vc.length] : undefined;
    }
    return node;
  });
}

/** Same clients on every node (fast setup; diversity warnings will flag it). */
export function uniform(n: number, base: ClusterNode): ClusterNode[] {
  return Array.from({ length: n }, (_, i) => ({ ...base, label: `node-${i + 1}` }));
}

/** Resize keeping existing nodes; new nodes copy the last node's clients. */
export function resize(nodes: ClusterNode[], n: number): ClusterNode[] {
  if (n <= nodes.length) return nodes.slice(0, n);
  const last = nodes[nodes.length - 1] ?? {};
  return [...nodes, ...Array.from({ length: n - nodes.length }, (_, k) => ({ ...last, label: `node-${nodes.length + k + 1}` }))];
}

function isUsable(c: Component | undefined): boolean {
  return !!c && c.status !== 'deprecated' && c.status !== 'archived' && c.status !== 'experimental';
}

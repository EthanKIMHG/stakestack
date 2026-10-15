import 'server-only';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, ComponentLogo } from '@stakestack/shared/types';

/**
 * Component logos live in public/logos (sources: docs/LOGOS.md).
 *
 * A file named after the component slug (`<slug>.svg|png|webp|jpg`) always wins, so adding a
 * missing logo is just dropping the file in. Otherwise a component borrows its project's or
 * vendor's logo from SHARED. Components with neither get a monogram tile.
 */
const SHARED: Record<string, string> = {
  // execution
  geth: 'geth.png', nethermind: 'nethermind.png', besu: 'besu.png', erigon: 'erigon.png', reth: 'reth.png',
  ethrex: 'ethrex.png', 'nimbus-eth1': 'nimbus.png',
  // consensus / validator
  lighthouse: 'lighthouse.png', prysm: 'prysm.svg', teku: 'teku.png', 'nimbus-eth2': 'nimbus.png', lodestar: 'lodestar.png',
  grandine: 'grandine.svg', caplin: 'erigon.png', vouch: 'attestant.png', vero: 'serenita.png',
  // dvt
  charon: 'obol.png', 'charon-distributed-validator-node': 'obol.png', 'obol-monitoring': 'obol.png', 'lido-dv-exit': 'obol.png',
  'ssv-node': 'ssv.png', 'ssv-dkg': 'ssv.png', anchor: 'anchor.png',
  // mev
  'mev-boost': 'flashbots.png', 'mev-boost-relay': 'flashbots.png', 'commit-boost': 'commit-boost.png',
  // monitoring & ui
  'ethereum-metrics-exporter': 'ethpandaops.png', dora: 'ethpandaops.png', checkpointz: 'ethpandaops.png', contributoor: 'ethpandaops.png',
  'ethereum-validators-monitoring': 'lido.png', 'eth-validator-watcher': 'kiln.png', 'beaconchain-explorer': 'bitfly.png',
  siren: 'siren.png', 'prysm-web-ui': 'prysm.svg', grafana: 'grafana.png', prometheus: 'prometheus.png',
  // node managers
  'eth-docker': 'ethstaker.png', ethpillar: 'coincashew.png', stereum: 'stereum.png', dappnode: 'dappnode.png', sedge: 'sedge.svg',
  'nice-node': 'nicenode.png', 'ethereum-on-arm': 'ethereum-on-arm.png',
  // protocols
  'lido-csm': 'lido.png', 'lido-simple-dvt': 'lido.png', 'validator-ejector': 'lido.png', 'lido-keys-api': 'lido.png',
  'rocketpool-smartnode': 'rocket-pool.png', hyperdrive: 'nodeset.png', 'stakewise-v3-operator': 'stakewise.png',
  'eigenlayer-cli': 'eigenlayer.png', 'puffer-coral': 'puffer.png',
  // signers & keys
  web3signer: 'web3signer.png', dirk: 'attestant.png', 'ethstaker-deposit-cli': 'ethstaker.png', 'staking-deposit-cli': 'ethereum.png',
  'wagyu-key-gen': 'wagyu.png', ethdo: 'weald.png', ethereal: 'weald.png',
  // specs & network configs
  'consensus-specs': 'ethereum.png', 'execution-specs': 'ethereum.png', 'execution-apis': 'ethereum.png', 'beacon-apis': 'ethereum.png',
  'builder-specs': 'ethereum.png', 'ethereum-pm': 'ethereum.png', 'eth-clients-mainnet': 'ethereum.png', 'eth-clients-hoodi': 'ethereum.png',
  'eth-clients-sepolia': 'ethereum.png', 'eth-clients-holesky': 'ethereum.png', 'ephemery-genesis': 'ephemery.png', 'ethstaker-guides': 'ethstaker.png',
};

/** Files with their own opaque background. */
const BLEED = new Set([
  'bitfly.png', 'dappnode.png', 'eigenlayer.png', 'ephemery.png', 'erigon.png', 'ethereum-on-arm.png', 'ethpandaops.png', 'ethrex.png',
  'ethstaker.png', 'grafana.png', 'kiln.png', 'lido.png', 'nethermind.png', 'nicenode.png', 'nodeset.png', 'puffer.png', 'reth.png',
  'serenita.png', 'teku.png', 'weald.png',
]);

const EXT = /\.(svg|png|webp|jpe?g)$/i;
const DIR = join(process.cwd(), 'public/logos');
let scanned: Map<string, string> | null = null;

/** slug -> file for logos dropped in by name. Re-read on every call in dev so new files show up on refresh. */
function dropIns(): Map<string, string> {
  if (scanned && process.env.NODE_ENV === 'production') return scanned;
  const out = new Map<string, string>();
  try {
    for (const f of readdirSync(DIR)) if (EXT.test(f)) out.set(f.replace(EXT, ''), f);
  } catch { /* directory not traced into this function: the SHARED map still applies */ }
  scanned = out;
  return out;
}

export function logoFor(slug: string): ComponentLogo | undefined {
  const file = dropIns().get(slug) ?? SHARED[slug];
  return file ? { src: `/logos/${file}`, bleed: BLEED.has(file) || undefined } : undefined;
}

export function withLogos(catalog: Catalog): Catalog {
  return { ...catalog, components: catalog.components.map(c => ({ ...c, logo: logoFor(c.slug) })) };
}

/** For client components that only get slugs (release rows, readiness tables). */
export function logoMap(slugs: Iterable<string>): Record<string, ComponentLogo> {
  const out: Record<string, ComponentLogo> = {};
  for (const s of slugs) { const l = logoFor(s); if (l) out[s] = l; }
  return out;
}

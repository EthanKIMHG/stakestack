import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadCatalog, validateCatalog } from '../catalog';
import { compose } from '../composer';
import { computeReadiness, upgradePhase } from '../readiness';
import { analyzeTopology, clusterThreshold, diversify, faultTolerance, uniform } from '../topology';
import { PRESETS } from '../presets';
import type { Catalog, Release, Upgrade } from '../types';
import { newest, tagToVersion } from '../versions';

const dir = resolve(__dirname, '../../../../catalog');
const catalog = loadCatalog(dir);
const errors = (r: ReturnType<typeof compose>) => r.diagnostics.filter(d => d.level === 'error');

describe('catalog', () => {
  it('is valid', () => { expect(validateCatalog(dir)).toEqual([]); });
  it('has official Glamsterdam Sepolia data', () => {
    const u = catalog.upgrades.find(x => x.id === 'glamsterdam-sepolia')!;
    expect(u.status).toBe('activated');
    expect(u.activation_epoch).toBe(353024);
    expect(u.required_versions.lighthouse).toBe('8.3.0-rc.0');
    expect(catalog.upgrades.find(x => x.id === 'glamsterdam-hoodi')!.tentative).toBe(true);
  });
});

describe('compose', () => {
  it('charon turns EL/CL/VC into a cluster managed by nodes', () => {
    const topology = { nodes: [
      { execution: 'nethermind', consensus: 'lighthouse', validator: 'lighthouse' },
      { execution: 'geth', consensus: 'teku', validator: 'teku' },
      { execution: 'besu', consensus: 'nimbus-eth2', validator: 'nimbus-eth2' },
      { execution: 'reth', consensus: 'lodestar', validator: 'lodestar' },
    ] };
    const r = compose(catalog, { network: ['hoodi', 'mainnet'], dvt: ['charon'] }, topology);
    expect(r.cluster?.roles).toEqual(['execution', 'consensus', 'validator']);
    expect(r.selection.execution).toEqual(['nethermind', 'geth', 'besu', 'reth']);
    const vc = r.slots.find(s => s.slot.id === 'validator')!;
    expect(vc.cardinality).toBe('many');
    expect(vc.managedByCluster).toBe(true);
    expect(vc.options.map(o => o.slug)).not.toContain('grandine');
    expect(r.slots.find(s => s.slot.id === 'remote-signer')!.visible).toBe(true);
    expect(errors(r)).toEqual([]);
    expect(r.topology?.healthy).toBe(true);
  });
  it('charon without nodes asks for the cluster', () => {
    const r = compose(catalog, { network: ['hoodi'], dvt: ['charon'] });
    expect(errors(r).some(e => e.message.includes('cluster nodes'))).toBe(true);
  });
  it('dvt slot only offers middleware; companions go to dvt-extras', () => {
    const r = compose(catalog, { network: ['hoodi'], dvt: ['charon'] });
    expect(r.slots.find(s => s.slot.id === 'dvt')!.options.map(o => o.slug)).toEqual(expect.arrayContaining(['charon', 'ssv-node', 'anchor']));
    expect(r.slots.find(s => s.slot.id === 'dvt')!.options.map(o => o.slug)).not.toContain('charon-distributed-validator-node');
    expect(r.slots.find(s => s.slot.id === 'dvt-extras')!.options.map(o => o.slug)).toContain('charon-distributed-validator-node');
  });
  it('ssv hides the validator slot', () => {
    const r = compose(catalog, { network: ['mainnet'], dvt: ['ssv-node'] }, { nodes: [{ execution: 'geth', consensus: 'teku' }] });
    expect(r.slots.find(s => s.slot.id === 'validator')!.visible).toBe(false);
    expect(errors(r)).toEqual([]);
  });
  it('lido csm requires the ejector', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], protocol: ['lido-csm'] });
    expect(errors(r).some(d => d.rule === 'lido-csm')).toBe(true);
  });
  it('mainnet-only stacks get a testnet hint, hoodi+mainnet do not', () => {
    expect(compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'] }).diagnostics.some(d => d.message.startsWith('No testnet'))).toBe(true);
    expect(compose(catalog, { network: ['hoodi', 'mainnet'], execution: ['geth'], consensus: ['teku'] }).diagnostics.some(d => d.message.startsWith('No testnet'))).toBe(false);
  });
  it('every preset composes without errors', () => {
    for (const p of PRESETS) {
      const r = compose(catalog, p.selection, p.topology);
      expect({ preset: p.id, errors: errors(r).map(e => e.message) }).toEqual({ preset: p.id, errors: [] });
    }
  });
});

describe('topology', () => {
  const spec = { roles: ['execution', 'consensus', 'validator'] as const };
  it('threshold and tolerance follow ceil(2n/3)', () => {
    expect([3, 4, 7, 10].map(clusterThreshold)).toEqual([2, 3, 5, 7]);
    expect(faultTolerance(4)).toBe(1);
  });
  it('flags a client that runs on more nodes than the cluster can lose', () => {
    const t = { nodes: uniform(4, { execution: 'geth', consensus: 'lighthouse', validator: 'lighthouse' }) };
    const a = analyzeTopology(catalog, t, { roles: [...spec.roles] });
    expect(a.healthy).toBe(false);
    expect(a.diagnostics.filter(d => d.level === 'warn').length).toBe(3);
  });
  it('diversify spreads clients and respects the allowed list', () => {
    const nodes = diversify(catalog, 4, [...spec.roles], { allowed: {
      execution: ['geth', 'nethermind', 'besu', 'reth'], consensus: ['lighthouse', 'teku', 'nimbus-eth2', 'lodestar'], validator: ['lighthouse', 'teku', 'nimbus-eth2', 'lodestar'],
    } });
    expect(new Set(nodes.map(n => n.execution)).size).toBe(4);
    expect(nodes.every(n => n.validator === n.consensus)).toBe(true);
    expect(analyzeTopology(catalog, { nodes }, { roles: [...spec.roles] }).healthy).toBe(true);
  });
});

describe('readiness', () => {
  const releases: Release[] = [
    { component_slug: 'geth', repo: 'ethereum/go-ethereum', tag: 'v1.17.8', url: '', is_prerelease: false, published_at: '2026-10-08T00:00:00Z', source: 'releases' },
    { component_slug: 'geth', repo: 'ethereum/go-ethereum', tag: 'v1.18.0-rc.1', url: '', is_prerelease: true, published_at: '2026-10-10T00:00:00Z', source: 'releases' },
    { component_slug: 'teku', repo: 'Consensys/teku', tag: '26.10.0', url: '', is_prerelease: false, published_at: '2026-10-01T00:00:00Z', source: 'releases' },
  ];
  it('orders networks by rollout and uses pre-releases only on testnets', () => {
    const upgrades: Upgrade[] = [
      { id: 'x-sepolia', wave: 'glamsterdam', network: 'sepolia', status: 'scheduled', activation_time: '2026-11-01T00:00:00Z', required_versions: { geth: '1.18.0-rc.1' } },
      { id: 'x-mainnet', wave: 'glamsterdam', network: 'mainnet', status: 'planned', required_versions: {} },
    ];
    const cat: Catalog = { ...catalog, upgrades };
    const out = computeReadiness(cat, { name: 't', selection: { network: ['mainnet', 'sepolia'], execution: ['geth'], consensus: ['teku'] }, running_versions: { geth: 'v1.17.8' } }, releases, new Date('2026-10-14T00:00:00Z'));
    expect(out.map(n => n.network.id)).toEqual(['sepolia', 'mainnet']);
    expect(out.map(n => n.phase)).toEqual(['upcoming', 'tba']);
    const sepGeth = out[0]!.components.find(c => c.component_slug === 'geth')!;
    expect(sepGeth.latest_release).toBe('v1.18.0-rc.1');
    expect(sepGeth.state).toBe('behind');
    const mainGeth = out[1]!.components.find(c => c.component_slug === 'geth')!;
    expect(mainGeth.latest_release).toBe('v1.17.8');
    expect(mainGeth.state).toBe('ready');
  });
  it('real catalog: sepolia activated, hoodi upcoming (tentative), mainnet tba on 2026-10-14', () => {
    const out = computeReadiness(catalog, { name: 't', selection: { network: ['sepolia', 'hoodi', 'mainnet'], execution: ['geth'] } }, releases, new Date('2026-10-14T00:00:00Z'));
    expect(out.map(n => [n.network.id, n.phase, n.upgrade?.wave])).toEqual([
      ['sepolia', 'activated', 'glamsterdam'], ['hoodi', 'upcoming', 'glamsterdam'], ['mainnet', 'tba', 'glamsterdam'],
    ]);
    expect(upgradePhase(null)).toBe('none');
  });
});

describe('versions', () => {
  it('ignores non-version tags', () => {
    expect(tagToVersion('zisk-guest-r8')).toBeNull();
    expect(tagToVersion('zkvm-guests-2.1.0-unstable-5c2a2768')).toBeNull();
    expect(tagToVersion('v8.3.0-rc.0')).toBe('8.3.0-rc.0');
    expect(tagToVersion('26.9.1')).toBe('26.9.1');
    expect(newest(['2.1.0', 'zisk-guest-r8', '2.0.0'])).toBe('2.1.0');
  });
});

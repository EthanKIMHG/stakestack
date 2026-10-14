import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadCatalog, validateCatalog } from '../catalog';
import { compose } from '../composer';
import { computeReadiness } from '../readiness';
import type { Catalog, Release, Upgrade } from '../types';

const dir = resolve(__dirname, '../../../../catalog');
const catalog = loadCatalog(dir);

describe('catalog', () => {
  it('is valid', () => { expect(validateCatalog(dir)).toEqual([]); });
});

describe('compose', () => {
  it('charon restricts validator to supporting clients and opens remote-signer', () => {
    const r = compose(catalog, { network: ['hoodi', 'mainnet'], execution: ['nethermind'], consensus: ['lighthouse'], validator: ['lighthouse'], dvt: ['charon'] });
    const vc = r.slots.find(s => s.slot.id === 'validator')!;
    expect(vc.options.map(o => o.slug)).toContain('teku');
    expect(vc.options.map(o => o.slug)).not.toContain('grandine');
    expect(r.slots.find(s => s.slot.id === 'remote-signer')!.visible).toBe(true);
    expect(r.recommended).toContain('charon-distributed-validator-node');
    expect(r.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  });
  it('ssv hides the validator slot', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], dvt: ['ssv-node'] });
    expect(r.slots.find(s => s.slot.id === 'validator')!.visible).toBe(false);
    expect(r.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  });
  it('lido csm requires the ejector', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], protocol: ['lido-csm'] });
    expect(r.diagnostics.some(d => d.level === 'error' && d.rule === 'lido-csm')).toBe(true);
  });
  it('mainnet-only stacks get a testnet hint', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'] });
    expect(r.diagnostics.some(d => d.level === 'info')).toBe(true);
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
      { id: 'x-sepolia', wave: 'glamsterdam', network: 'sepolia', status: 'scheduled' as const, activation_time: '2026-11-01T00:00:00Z', required_versions: { geth: '1.18.0-rc.1' } },
      { id: 'x-mainnet', wave: 'glamsterdam', network: 'mainnet', status: 'planned' as const, required_versions: {} },
    ];
    const cat: Catalog = { ...catalog, upgrades };
    const out = computeReadiness(cat, { name: 't', selection: { network: ['mainnet', 'sepolia'], execution: ['geth'], consensus: ['teku'] }, running_versions: { geth: 'v1.17.8' } }, releases, new Date('2026-10-14T00:00:00Z'));
    expect(out.map(n => n.network.id)).toEqual(['sepolia', 'mainnet']);
    const sepGeth = out[0]!.components.find(c => c.component_slug === 'geth')!;
    expect(sepGeth.latest_release).toBe('v1.18.0-rc.1');
    expect(sepGeth.state).toBe('behind');
    const mainGeth = out[1]!.components.find(c => c.component_slug === 'geth')!;
    expect(mainGeth.latest_release).toBe('v1.17.8');
    expect(mainGeth.state).toBe('ready');
  });
});

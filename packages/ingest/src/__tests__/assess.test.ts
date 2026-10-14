import { describe, it, expect } from 'vitest';
import { assessRelease } from '../assess/rules';
import type { Release } from '@stakestack/shared/types';

const base: Release = { component_slug: 'x', repo: 'o/r', tag: 'v1.0.0', url: '', is_prerelease: false, published_at: '2026-01-01T00:00:00Z', source: 'releases' };

describe('assessRelease', () => {
  it('reads a Lighthouse update-priority table', () => {
    const body = `## Summary\nThis is a high-priority release containing fixes for several security vulnerabilities.\n\n## Update Priority\n| User Class | Beacon Node | Validator Client |\n|---|---|---|\n| Staking Users | High Priority | Medium Priority |\n| Non-Staking Users | High Priority | --- |`;
    const a = assessRelease({ ...base, component_slug: 'lighthouse', body }, 'lighthouse-table');
    expect(a.severity).toBe('critical');
    expect(a.flags).toContain('security');
    expect(a.evidence[0]!.kind).toBe('table');
  });
  it('flags a fork release on a testnet as hardfork + testnet-only', () => {
    const body = 'This pre-release enables the Glamsterdam fork on Hoodi at epoch 12345. Hoodi node operators must upgrade before activation.';
    const a = assessRelease({ ...base, component_slug: 'geth', tag: 'v1.18.0-rc.1', is_prerelease: true, body }, 'geth-prose');
    expect(a.flags).toEqual(expect.arrayContaining(['hardfork', 'prerelease', 'testnet-only', 'mandatory']));
    expect(a.networks).toEqual(['hoodi']);
    expect(a.wave).toBe('glamsterdam');
    expect(['high', 'critical']).toContain(a.severity);
  });
  it('reads Nimbus urgency guidance', () => {
    const body = 'Urgency guidance:\nAll mainnet users must upgrade before the fork on 2026-11-01.\n\nChanges...';
    const a = assessRelease({ ...base, component_slug: 'nimbus-eth2', body }, 'nimbus-urgency');
    expect(a.severity).toBe('high');
    expect(a.flags).toContain('mandatory');
  });
  it('leaves quiet releases low', () => {
    const a = assessRelease({ ...base, body: 'Bump dependencies. Fix typo in docs.' }, 'generic');
    expect(['optional', 'unassessed']).toContain(a.severity);
  });
});

import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadCatalog } from '../catalog';
import { compose } from '../composer';
import { analyzeTopology } from '../topology';
import { PRESETS, PRESET_GROUPS } from '../presets';
import type { StackSelection } from '../types';

const catalog = loadCatalog(resolve(__dirname, '../../../../catalog'));
const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = new Date().toISOString().slice(0, 10);

/** Put a component into the first slot whose role and tag filters accept it. */
function selectionWith(slug: string, network = 'mainnet'): StackSelection {
  const c = bySlug.get(slug)!;
  const slot = catalog.slots.find(s => c.roles.includes(s.role as never)
    && (!s.include_tag || c.tags?.includes(s.include_tag)) && (!s.exclude_tag || !c.tags?.includes(s.exclude_tag)));
  return { network: [network], [slot!.id]: [slug] };
}

describe('rules cite their sources', () => {
  for (const rule of catalog.rules) {
    it(`${rule.id} has sources and a check date`, () => {
      expect(rule.sources?.length).toBeGreaterThan(0);
      for (const u of rule.sources ?? []) expect(u).toMatch(/^https:\/\//);
      for (const c of rule.then.checks ?? []) if (c.source) expect(c.source).toMatch(/^https:\/\//);
      expect(rule.verified_at).toMatch(DATE);
      expect(rule.verified_at! <= today).toBe(true);
    });
    it(`${rule.id} fires on its trigger`, () => {
      const triggers = rule.when.all_of ?? [rule.when.component ?? rule.when.any_of?.[0]];
      expect(triggers.every(Boolean), 'rule needs a component trigger to be testable').toBe(true);
      const sel: StackSelection = { network: [rule.when.network ?? 'mainnet'] };
      for (const t of triggers) for (const [slot, slugs] of Object.entries(selectionWith(t!))) if (slot !== 'network') sel[slot] = [...(sel[slot] ?? []), ...slugs];
      const r = compose(catalog, sel);
      expect(r.rules).toContain(rule.id);
    });
  }
  it('protocol checks become sourced checklist items, not problems', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['nethermind'], consensus: ['teku'], protocol: ['lido-csm', 'validator-ejector'] });
    const fee = r.diagnostics.find(d => d.check && d.message.includes('Rewards Vault'));
    expect(fee?.source).toMatch(/^https:\/\/docs\.lido\.fi\//);
    expect(r.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  });
  it('rocket pool limits clients to the ones Smartnode supports', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['ethrex'], consensus: ['grandine'], protocol: ['rocketpool-smartnode'] });
    const msgs = r.diagnostics.filter(d => d.level === 'error').map(d => d.message);
    expect(msgs.some(m => m.startsWith('ethrex is not allowed') || m.includes('not allowed in Execution'))).toBe(true);
    expect(msgs.some(m => m.includes('not allowed in Consensus'))).toBe(true);
  });
  it('vero needs a remote signer, vouch only offers dirk', () => {
    const vero = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], validator: ['vero'] });
    expect(vero.diagnostics.some(d => d.level === 'error' && d.slot === 'remote-signer')).toBe(true);
    const vouch = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], validator: ['vouch'] });
    expect(vouch.slots.find(s => s.slot.id === 'remote-signer')!.options.map(o => o.slug)).toEqual(['dirk']);
  });
  it('charon clusters below the documented sizes are flagged', () => {
    const spec = catalog.rules.find(r => r.id === 'charon-opens-stack')!.then.cluster!;
    const node = { execution: 'geth', consensus: 'teku', validator: 'teku' };
    expect(analyzeTopology(catalog, { nodes: [node, node] }, spec).diagnostics.some(d => d.level === 'error' && d.message.includes('at least 3'))).toBe(true);
    expect(analyzeTopology(catalog, { nodes: [node, node, node] }, spec).diagnostics.some(d => d.level === 'warn' && d.message.includes('4 or more'))).toBe(true);
  });
  it('lido simple dvt asks for a DVT middleware, obol or ssv', () => {
    const none = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], protocol: ['lido-simple-dvt'] });
    expect(none.diagnostics.some(d => d.level === 'error' && d.slot === 'dvt')).toBe(true);
    const ssv = compose(catalog, { network: ['mainnet'], dvt: ['ssv-node'], protocol: ['lido-simple-dvt'] }, { nodes: [{ execution: 'geth', consensus: 'teku' }] });
    expect(ssv.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  });
  it('rule notes carry their source into diagnostics', () => {
    const r = compose(catalog, { network: ['mainnet'], execution: ['geth'], consensus: ['teku'], mev: ['mev-boost'] });
    const note = r.diagnostics.find(d => d.rule === 'mev-boost-needs-relay-config');
    expect(note?.source).toMatch(/^https:\/\//);
  });
});

describe('templates', () => {
  it('have unique ids and known groups', () => {
    expect(new Set(PRESETS.map(p => p.id)).size).toBe(PRESETS.length);
    const groups = new Set(PRESET_GROUPS.map(g => g.id));
    for (const p of PRESETS) expect(groups.has(p.group), p.id).toBe(true);
  });
  for (const p of PRESETS) {
    it(`${p.id} cites sources and composes cleanly`, () => {
      expect(p.sources.length).toBeGreaterThan(0);
      for (const u of p.sources) expect(u).toMatch(/^https:\/\//);
      expect(p.verified_at).toMatch(DATE);
      const r = compose(catalog, p.selection, p.topology);
      const problems = r.diagnostics.filter(d => d.level !== 'info' && !d.check).map(d => `${d.level}: ${d.message}`);
      expect(problems).toEqual([]);
      for (const slug of r.effectiveComponents) expect(bySlug.get(slug)?.status, slug).not.toMatch(/deprecated|archived/);
    });
  }
});

describe('hosting diversity', () => {
  const node = (execution: string, consensus: string, host?: string) => ({ execution, consensus, validator: consensus, host });
  const spec = { roles: ['execution', 'consensus', 'validator'] as const };
  it('warns when one provider hosts more nodes than the cluster can lose', () => {
    const nodes = [node('geth', 'lighthouse', 'OVHcloud'), node('nethermind', 'teku', 'ovhcloud'), node('besu', 'nimbus-eth2', 'AWS'), node('reth', 'lodestar', 'Hetzner')];
    const a = analyzeTopology(catalog, { nodes }, { roles: [...spec.roles] });
    expect(a.diagnostics.some(d => d.level === 'warn' && d.message.startsWith('OVHcloud hosts 2 of 4'))).toBe(true);
  });
  it('says so plainly when every node shares one provider', () => {
    const nodes = [node('geth', 'lighthouse', 'AWS'), node('nethermind', 'teku', 'AWS'), node('besu', 'nimbus-eth2', 'AWS'), node('reth', 'lodestar', 'AWS')];
    expect(analyzeTopology(catalog, { nodes }, { roles: [...spec.roles] }).diagnostics.some(d => d.message.startsWith('Every node is hosted on AWS'))).toBe(true);
  });
  it('stays quiet when hosting is spread or not filled in', () => {
    const spread = [node('geth', 'lighthouse', 'AWS'), node('nethermind', 'teku', 'OVHcloud'), node('besu', 'nimbus-eth2', 'Hetzner'), node('reth', 'lodestar', 'home')];
    const partial = [node('geth', 'lighthouse', 'AWS'), node('nethermind', 'teku', 'AWS'), node('besu', 'nimbus-eth2'), node('reth', 'lodestar')];
    for (const nodes of [spread, partial]) expect(analyzeTopology(catalog, { nodes }, { roles: [...spec.roles] }).diagnostics.some(d => /hosted|hosts/.test(d.message))).toBe(false);
  });
});

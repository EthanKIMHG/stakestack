import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { assessRelease } from '../assess/rules';
import type { Assessor, Flag, Release, Severity } from '@stakestack/shared/types';

const base: Release = { component_slug: 'x', repo: 'o/r', tag: 'v1.0.0', url: '', is_prerelease: false, published_at: '2026-01-01T00:00:00Z', source: 'releases' };
const run = (body: string, extra: Partial<Release> = {}, assessor: Assessor = 'generic') => assessRelease({ ...base, ...extra, body }, assessor);

describe('assessRelease', () => {
  it('reads a Lighthouse update-priority table', () => {
    const body = `## Summary\nThis is a high-priority release containing fixes for several security vulnerabilities.\n\n## Update Priority\n| User Class | Beacon Node | Validator Client |\n|---|---|---|\n| Staking Users | High Priority | Medium Priority |\n| Non-Staking Users | High Priority | --- |`;
    const a = run(body, { component_slug: 'lighthouse' }, 'lighthouse-table');
    expect(a.severity).toBe('critical');
    expect(a.flags).toContain('security');
    expect(a.evidence[0]!.kind).toBe('table');
  });
  it('flags a fork release on a testnet as hardfork + testnet-only', () => {
    const body = 'This pre-release enables the Glamsterdam fork on Hoodi at epoch 12345. Hoodi node operators must upgrade before activation.';
    const a = run(body, { component_slug: 'geth', tag: 'v1.18.0-rc.1', is_prerelease: true }, 'geth-prose');
    expect(a.flags).toEqual(expect.arrayContaining(['hardfork', 'prerelease', 'testnet-only', 'mandatory']));
    expect(a.networks).toEqual(['hoodi']);
    expect(a.wave).toBe('glamsterdam');
    expect(['high', 'critical']).toContain(a.severity);
  });
  it('reads the old Nimbus "Urgency guidance" paragraph', () => {
    const a = run('Urgency guidance:\nAll mainnet users must upgrade before the fork on 2026-11-01.\n\nChanges...', { component_slug: 'nimbus-eth2' }, 'nimbus-urgency');
    expect(a.severity).toBe('high');
    expect(a.flags).toContain('mandatory');
  });
  it('leaves quiet releases low', () => {
    expect(['optional', 'unassessed']).toContain(run('Bump dependencies. Fix typo in docs.').severity);
  });

  // ------------------------------------------------- false positives fixed in 2026.10.2 --
  it('does not raise a release to high because it mentions a fork name', () => {
    const a = run('## Changed\n- Cleanup Gloas block processing.\n- Reuse epoch_report from Electra.');
    expect(a.severity).not.toBe('high');
    expect(a.flags).not.toContain('hardfork');
  });
  it('ignores security words in generated PR lists', () => {
    const body = "Minor release.\n\n## What's Changed\n* fix security alerts in CI by @bot in https://github.com/o/r/pull/12\n* dos protection for processor by @dev in https://github.com/o/r/pull/13";
    expect(run(body).flags).not.toContain('security');
  });
  it('still counts a CVE in a generated PR list', () => {
    const body = "## What's Changed\n* bump grpc for CVE-2026-1234 by @dev in https://github.com/o/r/pull/14";
    expect(run(body).flags).toContain('security');
  });
  it('does not treat "performance and security" or "key security" as a security fix', () => {
    expect(run('Improved performance and security of epoch processing.').flags).not.toContain('security');
    expect(run('Web3signer service to lower key security works with large number of keys.').flags).not.toContain('security');
  });
  it('keeps the team level when a medium release has security fixes', () => {
    const a = run('This medium-priority release contains fixes for security vulnerabilities and is recommended for all mainnet users.');
    expect(a.severity).toBe('recommended');
    expect(a.flags).toContain('security');
  });
  it('ignores urgency stated only for other chains', () => {
    const a = run('This is a medium-urgency release for Ethereum. It is high-urgency for Gnosis due to the imminent Fulu fork.');
    expect(a.severity).toBe('recommended');
  });
  it('ignores urgency legends', () => {
    const a = run('This is a low-urgency release.\n\n- high-urgency: update as soon as you can, this is a critical update\n- medium-urgency: may contain an important stability fix');
    expect(a.severity).toBe('optional');
  });
  it('honours negations and hedges', () => {
    expect(run('This release is not mandatory. Operators may need to update their config.').flags).not.toContain('mandatory');
  });
  it('does not mark "Upcoming Breaking Changes" or "Breaking Changes: N/A" as breaking', () => {
    expect(run('## Upcoming Breaking Changes\n- `--foo` is deprecated and will be removed').flags).not.toContain('breaking');
    expect(run('This is a recommended update.\n\n### Breaking Changes\nN/A\n\n### Fixes\n- stuff').flags).not.toContain('breaking');
  });
  it('requires a risk signal before an unstated release can reach high', () => {
    const a = run('## Breaking Changes\n- Removed the --legacy flag entirely from the CLI\n\nDeprecated the old API. Performance improvements.');
    expect(a.severity).toBe('recommended');
  });
  it('lets an explicit team statement win over an inferred fork schedule', () => {
    const a = run('This RC is an optional update for Sepolia users.\n\n- Sepolia scheduled to fork on 2025-10-14 07:36:00', { is_prerelease: true });
    expect(a.severity).toBe('optional');
    expect(a.flags).toContain('hardfork');
  });
  it('keeps the score inside the severity band', () => {
    for (const body of ['high-priority release with security fixes', 'This is a recommended update.', 'This is a low-urgency release.']) {
      const a = run(body);
      const band: Record<Severity, [number, number]> = { critical: [85, 100], high: [60, 84], recommended: [25, 59], optional: [1, 24], unassessed: [0, 0] };
      expect(a.score).toBeGreaterThanOrEqual(band[a.severity][0]);
      expect(a.score).toBeLessThanOrEqual(band[a.severity][1]);
    }
  });
});

/* ---------------------------------------------------------------- golden set --
 * Real release notes (first 3,000 characters) with the rating an operator would
 * expect. `why` records the reasoning; change an expectation only with a reason. */
interface Golden {
  component_slug: string; assessor: Assessor; tag: string; is_prerelease: boolean; name: string | null; url: string; published_at: string; body: string; why: string;
  expect: { severity?: Severity; severityIn?: Severity[]; flags?: Flag[]; notFlags?: Flag[]; wave?: string };
}
const golden = JSON.parse(readFileSync(new URL('./fixtures/releases.json', import.meta.url), 'utf8')) as Golden[];

describe('golden release notes', () => {
  it.each(golden.map(g => [`${g.component_slug}@${g.tag}`, g] as const))('%s', (_id, g) => {
    const a = assessRelease({ ...base, component_slug: g.component_slug, tag: g.tag, name: g.name, body: g.body, is_prerelease: g.is_prerelease, url: g.url, published_at: g.published_at }, g.assessor);
    const ctx = `${g.why} -> got ${a.severity} [${a.flags.join(',')}] wave=${a.wave}`;
    if (g.expect.severity) expect(a.severity, ctx).toBe(g.expect.severity);
    if (g.expect.severityIn) expect(g.expect.severityIn, ctx).toContain(a.severity);
    for (const f of g.expect.flags ?? []) expect(a.flags, ctx).toContain(f);
    for (const f of g.expect.notFlags ?? []) expect(a.flags, ctx).not.toContain(f);
    if (g.expect.wave) expect(a.wave, ctx).toBe(g.expect.wave);
  });
});

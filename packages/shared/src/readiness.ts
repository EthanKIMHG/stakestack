import type { Catalog, Network, Release, Stack, Upgrade } from './types';
import { newest, satisfiesMinimum } from './versions';

export type ReadinessState = 'ready' | 'update-available' | 'behind' | 'no-release' | 'unknown';

export interface ComponentReadiness {
  component_slug: string;
  network: string;
  upgrade_id: string;
  required: string | null;          // from upgrade.required_versions
  latest_release: string | null;    // newest tag we have seen for the network (pre-releases allowed on testnets)
  running: string | null;           // operator-provided
  state: ReadinessState;
  detail: string;
}

export interface NetworkReadiness {
  network: Network;
  upgrade: Upgrade | null;
  activation_time: string | null;
  seconds_to_activation: number | null;
  components: ComponentReadiness[];
  summary: { ready: number; behind: number; unknown: number };
}

/** Pick the next relevant upgrade for a network: the earliest non-activated one in the rollout, else the last activated. */
export function nextUpgradeFor(catalog: Catalog, networkId: string, now = new Date()): Upgrade | null {
  const ups = catalog.upgrades.filter(u => u.network === networkId && u.status !== 'cancelled' && u.status !== 'draft');
  const pending = ups.filter(u => u.status !== 'activated' || (u.activation_time && new Date(u.activation_time) > now));
  if (pending.length > 0) {
    pending.sort((a, b) => (a.activation_time ?? '9999').localeCompare(b.activation_time ?? '9999'));
    return pending[0]!;
  }
  const done = ups.filter(u => u.activation_time).sort((a, b) => (b.activation_time ?? '').localeCompare(a.activation_time ?? ''));
  return done[0] ?? null;
}

/**
 * Per-network readiness for a stack. Testnets accept pre-release tags as
 * "latest"; mainnet only counts stable tags. `releases` must already be
 * filtered to the stack's components.
 */
export function computeReadiness(catalog: Catalog, stack: Stack, releases: Release[], now = new Date()): NetworkReadiness[] {
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const order = new Map(catalog.rollout_sequence.map((n, i) => [n, i]));
  const networks = (stack.selection.network ?? [])
    .map(id => catalog.networks.find(n => n.id === id))
    .filter((n): n is Network => !!n)
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const componentSlugs = new Set<string>();
  for (const [slot, slugs] of Object.entries(stack.selection)) if (slot !== 'network') for (const s of slugs) componentSlugs.add(s);

  return networks.map(network => {
    const upgrade = nextUpgradeFor(catalog, network.id, now);
    const allowPrerelease = network.kind !== 'mainnet';
    const components: ComponentReadiness[] = [...componentSlugs].map(slug => {
      const comp = bySlug.get(slug);
      const required = upgrade?.required_versions?.[slug] ?? null;
      const tags = releases.filter(r => r.component_slug === slug && (allowPrerelease || !r.is_prerelease)).map(r => r.tag);
      const latest = newest(tags);
      const running = stack.running_versions?.[slug] ?? null;
      let state: ReadinessState = 'unknown';
      let detail = '';
      if (!comp) { detail = 'component not in catalog'; }
      else if (!latest) { state = 'no-release'; detail = 'no release ingested yet'; }
      else if (required) {
        const ok = satisfiesMinimum(running ?? latest, required);
        if (ok === null) { state = 'unknown'; detail = `cannot compare ${running ?? latest} with required ${required}`; }
        else if (running) { state = ok ? 'ready' : 'behind'; detail = ok ? `running ${running} >= required ${required}` : `running ${running} < required ${required}; latest is ${latest}`; }
        else { state = ok ? 'update-available' : 'behind'; detail = ok ? `latest ${latest} satisfies ${required}; set running version to confirm` : `latest ingested ${latest} is below required ${required}`; }
      } else if (running) {
        const ok = satisfiesMinimum(running, latest);
        state = ok ? 'ready' : 'update-available';
        detail = ok ? `running latest ${latest}` : `running ${running}; latest ${latest}. No minimum published for ${upgrade?.id ?? 'this network'} yet.`;
      } else {
        state = 'unknown'; detail = `latest ${latest}; no required version published and no running version set`;
      }
      return { component_slug: slug, network: network.id, upgrade_id: upgrade?.id ?? '', required, latest_release: latest, running, state, detail };
    });
    const activation = upgrade?.activation_time ?? null;
    const secs = activation ? Math.round((new Date(activation).getTime() - now.getTime()) / 1000) : null;
    const summary = {
      ready: components.filter(c => c.state === 'ready' || c.state === 'update-available').length,
      behind: components.filter(c => c.state === 'behind').length,
      unknown: components.filter(c => c.state === 'unknown' || c.state === 'no-release').length,
    };
    return { network, upgrade, activation_time: activation, seconds_to_activation: secs, components, summary };
  });
}

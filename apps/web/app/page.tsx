import { getCatalog, getLatestAssessed } from '@/lib/catalog';
import { Timeline } from '@/components/Timeline';
import { isrSeconds } from '@/lib/supabase';

export const revalidate = 300;

export default async function Home() {
  const [catalog, rows] = await Promise.all([getCatalog(), getLatestAssessed(30)]);
  const roles = new Map<string, number>();
  for (const c of catalog.components) for (const r of c.roles) roles.set(r, (roles.get(r) ?? 0) + 1);
  return (
    <div className="space-y-8">
      <section className="card">
        <h1 className="text-2xl font-bold">Every staking release that matters, for your exact stack.</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          Pick EL, CL, VC, DVT (Charon, SSV), signers, MEV sidecars, protocol modules and monitoring. stakestack tracks {catalog.components.length} open-source components,
          scores each release with evidence, and shows readiness per network in rollout order: sepolia, hoodi, mainnet.
        </p>
        <div className="mt-4 flex gap-3">
          <a href="/build" className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: 'var(--accent)', color: '#052e16' }}>Build your stack</a>
          <a href="/upgrades" className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--line)' }}>Fork timeline</a>
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>{[...roles.entries()].map(([r, n]) => `${r} ${n}`).join(' · ')} · ISR {isrSeconds}s</p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent releases rated recommended or higher</h2>
        <Timeline rows={rows} />
      </section>
    </div>
  );
}

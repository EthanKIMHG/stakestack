import { notFound } from 'next/navigation';
import { compose } from '@stakestack/shared/composer';
import { computeReadiness } from '@stakestack/shared/readiness';
import type { Stack, StackSelection } from '@stakestack/shared/types';
import { getCatalog, getReleases, getStack, getTimeline } from '@/lib/catalog';
import { Timeline } from '@/components/Timeline';
import { Readiness } from '@/components/Readiness';

export const revalidate = 300;

export default async function StackPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sel?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const catalog = await getCatalog();
  let stack: Stack | null = null;
  if (slug === 'preview' && sp.sel) {
    try { stack = { name: 'Preview', selection: JSON.parse(sp.sel) as StackSelection }; } catch { notFound(); }
  } else {
    stack = await getStack(slug);
  }
  if (!stack) notFound();
  const result = compose(catalog, stack.selection);
  const [releases, timeline] = await Promise.all([getReleases(result.effectiveComponents), getTimeline(stack.selection, 100)]);
  const readiness = computeReadiness(catalog, stack, releases);
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-bold">{stack.name}</h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          {Object.entries(stack.selection).filter(([k]) => k !== 'network').map(([k, v]) => `${k}: ${v.map(s => bySlug.get(s)?.name ?? s).join(', ')}`).join(' · ')}
        </p>
        {slug !== 'preview' && <p className="mt-1 text-xs">Feeds: <a href={`/api/feed/${slug}.rss`}>RSS</a> · <a href={`/api/feed/${slug}.json`}>JSON</a></p>}
        {result.diagnostics.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">{result.diagnostics.map((d, i) => <li key={i} className={d.level === 'error' ? 'state-behind' : d.level === 'warn' ? 'state-update-available' : ''}>{d.level}: {d.message}</li>)}</ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Readiness per network <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>rollout: {catalog.rollout_sequence.join(' → ')}</span></h2>
        <Readiness nets={readiness} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Release timeline</h2>
        <Timeline rows={timeline} />
      </section>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { Link2, Rss } from 'lucide-react';
import { compose } from '@stakestack/shared/composer';
import { computeReadiness } from '@stakestack/shared/readiness';
import type { Stack, StackSelection, Topology } from '@stakestack/shared/types';
import { getCatalog, getReleases, getStack, getTimeline } from '@/lib/catalog';
import { ReleaseList } from '@/components/ReleaseList';
import { ReadinessGrid } from '@/components/ReadinessGrid';
import { StackSummary } from '@/components/StackSummary';
import { Card, Pill } from '@/components/ui';

export const revalidate = 300;

export const metadata = {
  title: 'Staking stack',
  robots: { index: false, follow: true },
};

export default async function StackPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sel?: string; topo?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const catalog = await getCatalog();
  let stack: Stack | null = null;
  if (slug === 'preview' && sp.sel) {
    try {
      stack = { name: 'Preview', selection: JSON.parse(sp.sel) as StackSelection, topology: sp.topo ? (JSON.parse(sp.topo) as Topology) : null };
    } catch { notFound(); }
  } else {
    stack = await getStack(slug);
  }
  if (!stack) notFound();
  const result = compose(catalog, stack.selection, stack.topology ?? null);
  const [releases, timeline] = await Promise.all([getReleases(result.effectiveComponents), getTimeline(result.selection, 120)]);
  const readiness = computeReadiness(catalog, { ...stack, selection: result.selection }, releases);
  const names = Object.fromEntries(catalog.components.map(c => [c.slug, c.name]));
  const logos = Object.fromEntries(catalog.components.filter(c => c.logo).map(c => [c.slug, c.logo!]));
  const behind = readiness.reduce((n, r) => n + r.summary.behind, 0);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">{slug === 'preview' ? 'Unsaved preview' : 'Saved stack'}</div>
          <h1 className="page-title" style={{ marginTop: 4 }}>{stack.name}</h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {behind > 0 ? <Pill tone="danger">{behind} behind a required version</Pill> : <Pill tone="ok">Nothing behind a required version</Pill>}
            <Pill>{result.effectiveComponents.length} components</Pill>
            {result.cluster && result.topology && <Pill tone="accent">{result.topology.n}-node cluster</Pill>}
          </div>
        </div>
        {slug !== 'preview' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn btn-sm" href={`/api/feed/${slug}.rss`}><Rss aria-hidden />RSS</a>
            <a className="btn btn-sm" href={`/api/feed/${slug}.json`}><Link2 aria-hidden />JSON</a>
          </div>
        )}
      </div>

      <div className="builder">
        <div className="builder-main">
          <section style={{ minWidth: 0, display: 'grid', gap: 10 }}>
            <div className="eyebrow">Fork readiness</div>
            <ReadinessGrid nets={readiness} names={names} logos={logos} />
          </section>
          <Card title="Releases for this stack">
            <ReleaseList rows={timeline} logos={logos} />
          </Card>
        </div>
        <StackSummary catalog={catalog} result={result} topology={stack.topology ?? null} />
      </div>
    </div>
  );
}

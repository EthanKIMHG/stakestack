import { notFound } from 'next/navigation';
import { compose } from '@stakestack/shared/composer';
import { computeReadiness } from '@stakestack/shared/readiness';
import type { Stack, StackSelection, Topology } from '@stakestack/shared/types';
import { getCatalog, getReleases, getStack, getTimeline } from '@/lib/catalog';
import { ReleaseList } from '@/components/ReleaseList';
import { ReadinessGrid } from '@/components/ReadinessGrid';
import { StackSummary } from '@/components/StackSummary';
import { Card } from '@/components/ui';

export const revalidate = 300;

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
  const behind = readiness.reduce((n, r) => n + r.summary.behind, 0);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="faint" style={{ fontSize: 13 }}>{slug === 'preview' ? 'Unsaved preview' : 'Saved stack'}</div>
          <h1 className="page-title">{stack.name}</h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {behind > 0 ? <span className="chip chip-err">{behind} component{behind > 1 ? 's' : ''} behind a required version</span> : <span className="chip chip-ok">No component behind a required version</span>}
            <span className="chip">{result.effectiveComponents.length} components</span>
            {result.cluster && result.topology && <span className="chip chip-accent">{result.topology.n}-node cluster</span>}
          </div>
        </div>
        {slug !== 'preview' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn btn-sm" href={`/api/feed/${slug}.rss`}>RSS feed</a>
            <a className="btn btn-sm" href={`/api/feed/${slug}.json`}>JSON</a>
          </div>
        )}
      </div>

      <div className="builder">
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
          <section style={{ minWidth: 0 }}>
            <div className="section-title">Fork readiness by network</div>
            <ReadinessGrid nets={readiness} names={names} />
          </section>
          <Card title={<div><h2>Releases for this stack</h2><span className="faint" style={{ fontSize: 13 }}>Pre-releases appear because the stack includes a testnet</span></div>}>
            <ReleaseList rows={timeline} />
          </Card>
        </div>
        <StackSummary catalog={catalog} result={result} topology={stack.topology ?? null} />
      </div>
    </div>
  );
}

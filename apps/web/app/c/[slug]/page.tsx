import { notFound } from 'next/navigation';
import { getCatalog, getTimeline } from '@/lib/catalog';
import { Timeline } from '@/components/Timeline';

export const revalidate = 300;

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.components.find(x => x.slug === slug);
  if (!c) notFound();
  const rows = await getTimeline({ network: ['hoodi'], any: [slug] }, 50);
  const requiredIn = catalog.upgrades.filter(u => u.required_versions?.[slug]).map(u => ({ id: u.id, network: u.network, v: u.required_versions[slug]! }));
  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-xl font-bold">{c.name} <span className="text-sm font-normal" style={{ color: 'var(--muted)' }}>{c.vendor}</span></h1>
        <p className="mt-1 text-sm">{c.summary}</p>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          roles: {c.roles.join(', ')} · status: {c.status} · assessor: {c.assessor} · weight {c.priority_weight ?? 1} · <a href={`https://github.com/${c.repo}`} target="_blank" rel="noreferrer">{c.repo}</a>
          {c.docs && <> · <a href={c.docs} target="_blank" rel="noreferrer">docs</a></>}
        </p>
        {c.notes && <p className="mt-2 text-xs">{c.notes}</p>}
        {requiredIn.length > 0 && <p className="mt-2 text-xs">Required versions: {requiredIn.map(r => `${r.network} ${r.id}: ≥ ${r.v}`).join(' · ')}</p>}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Releases (incl. pre-releases)</h2>
        <Timeline rows={rows} />
      </section>
    </div>
  );
}

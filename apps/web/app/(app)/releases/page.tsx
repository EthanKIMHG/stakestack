import { getCatalog, getLatestAssessedAll } from '@/lib/catalog';
import { logoMap } from '@/lib/logos';
import { ReleaseList } from '@/components/ReleaseList';
import { Breadcrumbs } from '@/components/JsonLd';

export const revalidate = 300;

export const metadata = {
  title: 'Ethereum client releases rated by severity',
  description: 'Latest releases of Ethereum execution, consensus and validator clients, DVT, MEV and staking tools, rated critical, high or recommended with the evidence from each release note.',
  alternates: { canonical: '/releases' },
};

export default async function ReleasesPage() {
  const [rows, catalog] = await Promise.all([getLatestAssessedAll(250), getCatalog()]);
  const slugs = new Set(rows.map(r => r.component_slug));
  const roles = Object.fromEntries(catalog.components.filter(c => slugs.has(c.slug)).map(c => [c.slug, c.roles as string[]]));
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Breadcrumbs items={[{ name: 'Releases', path: '/releases' }]} />
      <div className="page-head">
        <div>
          <h1 className="page-title">Releases</h1>
          <p className="page-sub">Every tracked component, newest first. Click any badge to filter by it.</p>
        </div>
      </div>
      <ReleaseList
        rows={rows} logos={logoMap(slugs)} roles={roles} layout="sidebar" syncUrl personalize
        facets={['sev', 'type', 'cat', 'net', 'fork']}
        emptyText="No releases ingested yet. The ingester runs every 30 minutes."
      />
    </div>
  );
}

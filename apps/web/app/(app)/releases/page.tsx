import { getLatestAssessedAll } from '@/lib/catalog';
import { logoMap } from '@/lib/logos';
import { ReleaseList } from '@/components/ReleaseList';

export const revalidate = 300;

export const metadata = {
  title: 'Ethereum client releases rated by severity',
  description: 'Latest releases of Ethereum execution, consensus and validator clients, DVT, MEV and staking tools, rated critical, high or recommended with the evidence from each release note.',
  alternates: { canonical: '/releases' },
};

export default async function ReleasesPage() {
  const rows = await getLatestAssessedAll(250);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Releases</h1>
          <p className="page-sub">Every tracked component, newest first.</p>
        </div>
      </div>
      <section className="card">
        <ReleaseList rows={rows} logos={logoMap(rows.map(r => r.component_slug))} emptyText="No releases ingested yet. The ingester runs every 30 minutes." />
      </section>
    </div>
  );
}

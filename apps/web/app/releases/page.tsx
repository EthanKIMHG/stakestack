import { getLatestAssessedAll } from '@/lib/catalog';
import { ReleaseList } from '@/components/ReleaseList';
import { Card } from '@/components/ui';

export const revalidate = 300;

export default async function ReleasesPage() {
  const rows = await getLatestAssessedAll(250);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h1 className="page-title">Releases</h1>
        <p className="muted">Every tracked component, newest first. Filter by severity; pre-releases are what testnets run before a fork.</p>
      </div>
      <Card><ReleaseList rows={rows} /></Card>
    </div>
  );
}

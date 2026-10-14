import { getCatalog, getLatestAssessed, currentWave } from '@/lib/catalog';
import { ReleaseList } from '@/components/ReleaseList';
import { WaveProgress } from '@/components/WaveProgress';
import { Card } from '@/components/ui';

export const revalidate = 300;

export default async function Home() {
  const [catalog, rows] = await Promise.all([getCatalog(), getLatestAssessed(40)]);
  const wave = currentWave(catalog);
  const critical = rows.filter(r => r.severity === 'critical').length;
  const high = rows.filter(r => r.severity === 'high').length;
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card hero">
        <div>
          <h1>Know which staking releases matter for your exact stack.</h1>
          <p>
            Pick your execution, consensus and validator clients, DVT middleware, signers, MEV sidecars and protocol modules.
            stakestack rates every release with evidence and shows fork readiness network by network, Sepolia to Hoodi to Mainnet.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <a href="/build" className="btn btn-primary">Build your stack</a>
            <a href="/upgrades" className="btn">See fork timeline</a>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="stat"><b>{catalog.components.length}</b><span>components tracked</span></div>
          <div className="stat"><b style={{ color: 'var(--sev-critical)' }}>{critical}</b><span>critical, recent</span></div>
          <div className="stat"><b style={{ color: 'var(--sev-high)' }}>{high}</b><span>high, recent</span></div>
        </div>
      </section>

      {wave && (
        <Card title={<div><h2>{wave.name} rollout</h2><span className="faint" style={{ fontSize: 13 }}>Current network upgrade</span></div>} actions={<a href="/upgrades" className="btn btn-sm">Details & versions</a>}>
          <div className="card-pad"><WaveProgress catalog={catalog} wave={wave} /></div>
        </Card>
      )}

      <Card title={<div><h2>Latest important releases</h2><span className="faint" style={{ fontSize: 13 }}>Stable releases of clients and operator software, newest first</span></div>} actions={<a href="/releases" className="btn btn-sm">All releases</a>}>
        <ReleaseList rows={rows} showPrereleaseToggle={false} emptyText="No releases ingested yet. The ingester runs every 30 minutes." />
      </Card>
    </div>
  );
}

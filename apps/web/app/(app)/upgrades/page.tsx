import { ChevronRight, ExternalLink } from 'lucide-react';
import { getCatalog, currentWave } from '@/lib/catalog';
import { WaveProgress } from '@/components/WaveProgress';
import { Logo } from '@/components/Logo';
import { NetDot, Pill } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import type { Catalog, Wave } from '@stakestack/shared/types';

export const revalidate = 300;

export const metadata = {
  title: 'Ethereum hard fork timeline and required client versions',
  description: 'Glamsterdam, Fusaka and Pectra rollouts across Sepolia, Hoodi and Mainnet: activation epochs, dates and the minimum Geth, Nethermind, Besu, Reth, Erigon, Lighthouse, Prysm, Teku, Nimbus, Lodestar and Grandine versions.',
  alternates: { canonical: '/upgrades' },
};

export default async function UpgradesPage() {
  const catalog = await getCatalog();
  const current = currentWave(catalog);
  const others = [...catalog.waves].reverse().filter(w => w.id !== current?.id);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Fork waves</h1>
          <p className="page-sub">Sepolia → Hoodi → Mainnet, with the minimum client versions for each.</p>
        </div>
      </div>
      {current && <WaveCard catalog={catalog} wave={current} open />}
      {others.map(w => <WaveCard key={w.id} catalog={catalog} wave={w} />)}
    </div>
  );
}

const STATUS_TONE = { in_progress: 'accent', completed: 'ok', planning: 'neutral' } as const;

function WaveCard({ catalog, wave, open = false }: { catalog: Catalog; wave: Wave; open?: boolean }) {
  const order = catalog.rollout_sequence;
  const ups = catalog.upgrades.filter(u => u.wave === wave.id);
  const nets = [...order, ...ups.map(u => u.network).filter(n => !order.includes(n))].filter((n, i, a) => a.indexOf(n) === i && ups.some(u => u.network === n));
  const slugs = [...new Set(ups.flatMap(u => Object.keys(u.required_versions ?? {})))];
  const comp = new Map(catalog.components.map(c => [c.slug, c]));
  const groups = [
    { label: 'Execution', items: slugs.filter(s => comp.get(s)?.roles.includes('execution')) },
    { label: 'Consensus', items: slugs.filter(s => comp.get(s)?.roles.includes('consensus') && !comp.get(s)?.roles.includes('execution')) },
  ];
  const body = (
    <>
      <div className="card-body"><WaveProgress catalog={catalog} wave={wave} /></div>
      {slugs.length > 0 ? (
        <div className="scroll-x" style={{ borderTop: '1px solid var(--color-line-2)' }}>
          <table className="matrix">
            <thead><tr><th>Client</th>{nets.map(n => <th key={n}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><NetDot id={n} />{catalog.networks.find(x => x.id === n)?.name ?? n}</span></th>)}</tr></thead>
            <tbody>
              {groups.map(g => g.items.length > 0 && [
                <tr key={g.label} className="group"><td colSpan={nets.length + 1}>{g.label}</td></tr>,
                ...g.items.map(s => {
                  const c = comp.get(s);
                  return (
                    <tr key={s}>
                      <td><a href={`/c/${s}`} className="comp-cell"><Logo logo={c?.logo} name={c?.name ?? s} size={24} />{c?.name ?? s}</a></td>
                      {nets.map(n => { const v = ups.find(u => u.network === n)?.required_versions?.[s]; return <td key={n} className="v">{v ? `≥ ${v}` : <span className="faint">—</span>}</td>; })}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      ) : <div className="empty" style={{ borderTop: '1px solid var(--color-line-2)' }}>Client versions not published yet.</div>}
      <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--color-line-2)', display: 'grid', gap: 8, fontSize: 13 }}>
        {nets.map(n => {
          const u = ups.find(x => x.network === n)!;
          return (
            <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <NetDot id={n} /><b style={{ fontWeight: 600 }}>{catalog.networks.find(x => x.id === n)?.name ?? n}</b>
              <span className="muted">{u.activation_time ? fmtDateTime(u.activation_time) : 'date TBA'}{u.activation_epoch ? ` · epoch ${u.activation_epoch.toLocaleString('en-US')}` : ''}</span>
              {u.tentative && <Pill tone="flag" className="pill-sm">tentative</Pill>}
              {!u.verified && !u.tentative && u.activation_time && <Pill className="pill-sm">unverified</Pill>}
              {u.announcement && <a href={u.announcement} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Announcement<ExternalLink aria-hidden width={12} height={12} /></a>}
              {u.notes && <span className="faint" style={{ flexBasis: '100%', paddingLeft: 16, fontSize: 12.5 }}>{u.notes}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
  const title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <h2 className="h2">{wave.name}</h2>
      <Pill tone={STATUS_TONE[wave.status] ?? 'neutral'}>{wave.status.replace('_', ' ')}</Pill>
      {wave.meta_eip && <a href={wave.meta_eip} target="_blank" rel="noreferrer" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Meta EIP<ExternalLink aria-hidden width={12} height={12} /></a>}
    </div>
  );
  if (open) return <section className="card"><div className="card-head">{title}</div>{body}</section>;
  return (
    <details className="card fold">
      <summary><ChevronRight className="chev" aria-hidden />{title}</summary>
      <div style={{ borderTop: '1px solid var(--color-line-2)' }}>{body}</div>
    </details>
  );
}

import { getCatalog } from '@/lib/catalog';

export const revalidate = 300;

export default async function UpgradesPage() {
  const catalog = await getCatalog();
  const order = new Map(catalog.rollout_sequence.map((n, i) => [n, i]));
  const waves = [...catalog.waves].reverse();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Fork waves <span className="text-sm font-normal" style={{ color: 'var(--muted)' }}>{catalog.rollout_sequence.join(' → ')}</span></h1>
      {waves.map(w => {
        const ups = catalog.upgrades.filter(u => u.wave === w.id).sort((a, b) => (order.get(a.network) ?? 99) - (order.get(b.network) ?? 99));
        return (
          <section key={w.id} className="card">
            <h2 className="font-semibold">{w.name} <span className="badge sev-unassessed">{w.status}</span>{w.meta_eip && <> · <a href={w.meta_eip} target="_blank" rel="noreferrer" className="text-xs">meta EIP</a></>}</h2>
            <table className="mt-3 w-full text-xs">
              <thead style={{ color: 'var(--muted)' }}><tr><th className="text-left">network</th><th className="text-left">status</th><th className="text-left">activation</th><th className="text-left">epoch</th><th className="text-left">required versions</th><th></th></tr></thead>
              <tbody>
                {ups.map(u => (
                  <tr key={u.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                    <td className="py-1">{u.network}</td>
                    <td>{u.status}{u.verified === false && <span className="flag ml-1">unconfirmed</span>}</td>
                    <td>{u.activation_time ? u.activation_time.replace('T', ' ').slice(0, 16) + ' UTC' : 'TBA'}</td>
                    <td>{u.activation_epoch ?? '—'}</td>
                    <td>{Object.keys(u.required_versions ?? {}).length ? Object.entries(u.required_versions).map(([k, v]) => `${k} ≥ ${v}`).join(', ') : <span style={{ color: 'var(--muted)' }}>not published</span>}</td>
                    <td>{u.announcement && <a href={u.announcement} target="_blank" rel="noreferrer">announcement</a>}</td>
                  </tr>
                ))}
                {ups.length === 0 && <tr><td colSpan={6} className="py-1" style={{ color: 'var(--muted)' }}>no upgrades recorded</td></tr>}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

import type { NetworkReadiness } from '@stakestack/shared/readiness';

function countdown(secs: number | null): string {
  if (secs === null) return 'date TBA';
  if (secs < 0) return `activated ${Math.round(-secs / 86400)}d ago`;
  const d = Math.floor(secs / 86400); const h = Math.floor((secs % 86400) / 3600);
  return `in ${d}d ${h}h`;
}

export function Readiness({ nets }: { nets: NetworkReadiness[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {nets.map(n => (
        <div key={n.network.id} className="card">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">{n.network.name}</h3>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>#{n.network.rollout_order}</span>
          </div>
          {n.upgrade ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {n.upgrade.wave} · {n.upgrade.status} · {countdown(n.seconds_to_activation)}{n.upgrade.verified === false && ' · unconfirmed'}
            </p>
          ) : <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>no upgrade on record</p>}
          <p className="mt-2 text-xs">ready {n.summary.ready} · behind {n.summary.behind} · unknown {n.summary.unknown}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {n.components.map(c => (
              <li key={c.component_slug} className="flex justify-between gap-2">
                <span>{c.component_slug}</span>
                <span className={`state-${c.state} font-mono`} title={c.detail}>{c.running ?? '—'} / {c.required ?? 'n/a'} / {c.latest_release ?? '—'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px]" style={{ color: 'var(--muted)' }}>running / required / latest</p>
        </div>
      ))}
    </div>
  );
}

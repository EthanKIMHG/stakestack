import type { TimelineRow } from '@/lib/catalog';
import { SeverityBadge, Flags } from './SeverityBadge';

export function Timeline({ rows, emptyText = 'No releases ingested yet. Run the ingester or wait for the next cron run.' }: { rows: TimelineRow[]; emptyText?: string }) {
  if (rows.length === 0) return <p className="text-sm" style={{ color: 'var(--muted)' }}>{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map(r => (
        <li key={`${r.component_slug}-${r.tag}`} className="card">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={r.severity} />
            <a href={`/c/${r.component_slug}`} className="font-semibold">{r.component_name}</a>
            <a href={r.url} target="_blank" rel="noreferrer" className="font-mono text-sm">{r.tag}</a>
            {r.is_prerelease && <span className="flag">pre-release</span>}
            <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>{new Date(r.published_at).toISOString().slice(0, 10)}</span>
          </div>
          <div className="mt-1 text-xs"><Flags flags={r.flags} />{r.wave_id && <span className="flag">wave: {r.wave_id}</span>}{r.networks.map(n => <span key={n} className="flag">{n}</span>)}</div>
          {r.evidence?.length > 0 && (
            <details className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              <summary>evidence ({r.evidence.length})</summary>
              <ul className="mt-1 list-disc pl-5">{r.evidence.slice(0, 6).map((e, i) => <li key={i}>{e.text}</li>)}</ul>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

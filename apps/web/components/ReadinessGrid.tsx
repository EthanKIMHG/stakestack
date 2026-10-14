import type { NetworkReadiness } from '@stakestack/shared/readiness';
import { phaseText, relative, waveName } from '@/lib/format';
import { NetDot } from './ui';

export const STATE_LABEL: Record<string, string> = {
  ready: 'Ready', 'update-available': 'OK', behind: 'Behind', unknown: '—', 'no-release': 'No data',
};

/**
 * Network summary cards (phase, countdown, how many components are behind)
 * followed by one component x network matrix. A matrix stays readable when a
 * stack has 15+ components and 3 networks; per-network tables did not.
 */
export function ReadinessGrid({ nets, names }: { nets: NetworkReadiness[]; names: Record<string, string> }) {
  if (nets.length === 0) return <div className="card empty">Select a network to see fork readiness.</div>;
  const slugs = [...new Set(nets.flatMap(n => n.components.map(c => c.component_slug)))]
    .sort((a, b) => rank(nets, b) - rank(nets, a) || (names[a] ?? a).localeCompare(names[b] ?? b));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ready-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${nets.length > 2 ? 200 : 240}px, 1fr))` }}>
        {nets.map(n => (
          <section key={n.network.id} className="card card-pad" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <b style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 650 }}><NetDot id={n.network.id} />{n.network.name}</b>
              {n.phase === 'upcoming' && n.activation_time && <span className="chip chip-accent">{relative(n.activation_time)}</span>}
              {n.phase === 'activated' && <span className="chip chip-ok">Live</span>}
              {n.phase === 'tba' && <span className="chip">TBA</span>}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{n.upgrade ? `${waveName(n.upgrade.wave)} · ${phaseText(n.phase, n.upgrade)}` : 'No upgrade on record'}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {n.summary.behind > 0 ? <span className="chip chip-err">{n.summary.behind} behind</span>
                : n.components.some(c => c.required) ? <span className="chip chip-ok">All required versions met</span>
                : <span className="chip">No minimum versions published</span>}
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <div className="scroll-x">
          <table className="matrix">
            <thead>
              <tr>
                <th>Component</th>
                {nets.map(n => <th key={n.network.id}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><NetDot id={n.network.id} />{n.network.name}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {slugs.map(slug => (
                <tr key={slug}>
                  <td><a href={`/c/${slug}`}>{names[slug] ?? slug}</a></td>
                  {nets.map(n => {
                    const c = n.components.find(x => x.component_slug === slug);
                    if (!c) return <td key={n.network.id} className="faint">—</td>;
                    return (
                      <td key={n.network.id} title={c.detail}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ fontSize: 12.5 }}>{c.latest_release ?? <span className="faint">no release</span>}</span>
                          {c.state === 'behind' && <span className="st st-behind">needs ≥ {c.required}</span>}
                          {c.state !== 'behind' && c.required && <span className="st st-ready">≥ {c.required}</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint" style={{ fontSize: 12.5, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          Latest release seen per network (testnets include pre-releases). A green or red mark appears where the upgrade announcement sets a minimum version.
        </p>
      </section>
    </div>
  );
}

/** Behind first, then components with a requirement, then the rest. */
function rank(nets: NetworkReadiness[], slug: string): number {
  let r = 0;
  for (const n of nets) {
    const c = n.components.find(x => x.component_slug === slug);
    if (c?.state === 'behind') r += 10;
    else if (c?.required) r += 1;
  }
  return r;
}

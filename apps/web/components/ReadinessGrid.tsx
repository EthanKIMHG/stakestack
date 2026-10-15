import type { ComponentLogo } from '@stakestack/shared/types';
import type { NetworkReadiness } from '@stakestack/shared/readiness';
import { phaseText, relative, waveName } from '@/lib/format';
import { NetDot, Pill } from './ui';
import { Logo } from './Logo';

/**
 * Network summary tiles (phase, countdown, how many components are behind) followed by one
 * component x network matrix. A matrix stays readable with 15+ components and 3 networks.
 */
export function ReadinessGrid({ nets, names, logos = {} }: { nets: NetworkReadiness[]; names: Record<string, string>; logos?: Record<string, ComponentLogo> }) {
  if (nets.length === 0) return <div className="card empty">Select a network to see fork readiness.</div>;
  const slugs = [...new Set(nets.flatMap(n => n.components.map(c => c.component_slug)))]
    .sort((a, b) => rank(nets, b) - rank(nets, a) || (names[a] ?? a).localeCompare(names[b] ?? b));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="net-tiles" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${nets.length > 2 ? 200 : 240}px, 1fr))` }}>
        {nets.map(n => (
          <section key={n.network.id} className="card net-tile">
            <div className="net-tile-head">
              <b><NetDot id={n.network.id} />{n.network.name}</b>
              {n.phase === 'upcoming' && n.activation_time && <Pill tone="accent">{relative(n.activation_time)}</Pill>}
              {n.phase === 'activated' && <Pill tone="ok">Live</Pill>}
              {n.phase === 'tba' && <Pill>TBA</Pill>}
            </div>
            <div className="meta" style={{ marginTop: 4, fontSize: 12.5 }}>{n.upgrade ? `${waveName(n.upgrade.wave)} · ${phaseText(n.phase, n.upgrade)}` : 'No upgrade on record'}</div>
            <div style={{ marginTop: 10 }}>
              {n.summary.behind > 0 ? <Pill tone="danger">{n.summary.behind} behind</Pill>
                : n.components.some(c => c.required) ? <Pill tone="ok">All minimums met</Pill>
                : <Pill>No minimums published</Pill>}
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
                  <td><a href={`/c/${slug}`} className="comp-cell"><Logo logo={logos[slug]} name={names[slug] ?? slug} size={24} />{names[slug] ?? slug}</a></td>
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
        <div className="card-foot">Latest release seen per network; testnets include pre-releases.</div>
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

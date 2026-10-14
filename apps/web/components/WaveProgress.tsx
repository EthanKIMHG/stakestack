import type { Catalog, Upgrade, Wave } from '@stakestack/shared/types';
import { upgradePhase } from '@stakestack/shared/readiness';
import { fmtDateTime, relative } from '@/lib/format';
import { NetDot } from './ui';

/** Sepolia -> Hoodi -> Mainnet stepper for one fork wave. */
export function WaveProgress({ catalog, wave, now = new Date() }: { catalog: Catalog; wave: Wave; now?: Date }) {
  const steps = catalog.rollout_sequence.map(net => ({
    net,
    name: catalog.networks.find(n => n.id === net)?.name ?? net,
    up: catalog.upgrades.find(u => u.wave === wave.id && u.network === net) ?? null,
  }));
  const phases = steps.map(s => upgradePhase(s.up, now));
  const nextIdx = phases.findIndex(p => p !== 'activated');
  return (
    <div className="wave">
      {steps.map((s, i) => {
        const p = phases[i]!;
        const cls = p === 'activated' ? 'done' : i === nextIdx ? 'next' : '';
        return (
          <div key={s.net} className={`wave-step ${cls}`}>
            <div className="rail" />
            <div className="wave-node">{p === 'activated' ? '✓' : i + 1}</div>
            <div>
              <div className="wave-label"><NetDot id={s.net} />{s.name}</div>
              <div className="wave-meta">{stepText(p, s.up, now)}</div>
              <div className="wave-sub">{stepSub(p, s.up)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function stepText(p: string, u: Upgrade | null, now: Date): string {
  if (!u) return 'Not scheduled';
  if (p === 'activated') return `Activated ${relative(u.activation_time, now.getTime())}`;
  if (p === 'upcoming') return `${u.tentative ? 'Tentatively ' : ''}${relative(u.activation_time, now.getTime())}`;
  return 'Date not announced';
}
function stepSub(p: string, u: Upgrade | null): string {
  if (!u) return '';
  const parts: string[] = [];
  if (u.activation_time) parts.push(fmtDateTime(u.activation_time));
  if (u.activation_epoch) parts.push(`epoch ${u.activation_epoch.toLocaleString('en-US')}`);
  if (p === 'upcoming' && u.tentative) parts.push('epoch TBD');
  return parts.join(' · ');
}

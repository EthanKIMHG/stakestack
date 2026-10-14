import type { Upgrade } from '@stakestack/shared/types';
import type { UpgradePhase } from '@stakestack/shared/readiness';

const DAY = 86_400_000;

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const time = d.toISOString().slice(11, 16);
  return time === '00:00' ? date : `${date}, ${time} UTC`;
}

/** "in 13 days", "8 days ago", "today". Day granularity is enough for fork planning. */
export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  const days = Math.round(Math.abs(diff) / DAY);
  if (days === 0) return diff >= 0 ? 'today' : 'today';
  const unit = days === 1 ? 'day' : 'days';
  return diff > 0 ? `in ${days} ${unit}` : `${days} ${unit} ago`;
}

export function phaseText(phase: UpgradePhase, u: Upgrade | null): string {
  if (!u || phase === 'none') return 'No upgrade on record';
  if (phase === 'activated') return `Activated ${fmtDate(u.activation_time)}`;
  if (phase === 'upcoming') return `${u.tentative ? 'Tentative · ' : ''}${fmtDateTime(u.activation_time)}`;
  return 'Date not announced';
}

export function waveName(id: string | null | undefined): string {
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export const NETWORK_ORDER = ['sepolia', 'hoodi', 'mainnet'];

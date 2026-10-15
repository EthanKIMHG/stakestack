import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`sev sev-${severity}`}>{severity === 'unassessed' ? 'unrated' : severity}</span>;
}

type Tone = 'neutral' | 'accent' | 'ok' | 'flag' | 'danger';
export function Pill({ tone = 'neutral', children, className = '', title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span className={`pill ${tone === 'neutral' ? '' : `pill-${tone}`} ${className}`} title={title}>{children}</span>;
}

const FLAG_TONE: Record<string, Tone> = {
  security: 'danger', hotfix: 'danger', mandatory: 'flag', breaking: 'flag', hardfork: 'accent', 'testnet-only': 'accent',
};
export const flagTone = (flag: string): Tone => FLAG_TONE[flag] ?? 'neutral';

export function NetDot({ id }: { id: string }) {
  return <span className={`net-dot net-${id}`} aria-hidden />;
}

/** Errors, warnings and passing checks share one shape: an icon and a sentence. */
export function StatusPill({ errors, warnings }: { errors: number; warnings: number }) {
  if (errors) return <Pill tone="danger"><CircleAlert aria-hidden />{errors} to fix</Pill>;
  if (warnings) return <Pill tone="flag"><TriangleAlert aria-hidden />{warnings} warning{warnings > 1 ? 's' : ''}</Pill>;
  return <Pill tone="ok"><CircleCheck aria-hidden />Valid</Pill>;
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && <div className="card-head">{typeof title === 'string' ? <h2>{title}</h2> : title}{actions}</div>}
      {children}
    </section>
  );
}

const DIAG_ICON = { error: CircleAlert, warn: TriangleAlert, info: Info, ok: CircleCheck } as const;
export function Diag({ level, children, source }: { level: 'error' | 'warn' | 'info' | 'ok'; children: ReactNode; source?: string }) {
  const Icon = DIAG_ICON[level];
  return (
    <div className={`diag diag-${level}`}>
      <Icon aria-hidden />
      <span>{children}{source && <> <a className="diag-source" href={source} target="_blank" rel="noopener noreferrer">Source</a></>}</span>
    </div>
  );
}

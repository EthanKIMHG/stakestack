import type { ReactNode } from 'react';

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`sev sev-${severity}`}>{severity === 'unassessed' ? 'unrated' : severity}</span>;
}

const FLAG_STYLE: Record<string, string> = {
  security: 'chip-err', mandatory: 'chip-warn', hardfork: 'chip-accent', breaking: 'chip-warn', hotfix: 'chip-err',
  prerelease: '', 'testnet-only': 'chip-info', performance: '', deprecation: '',
};
export function Flag({ flag }: { flag: string }) {
  return <span className={`chip ${FLAG_STYLE[flag] ?? ''}`}>{flag}</span>;
}

export function NetDot({ id }: { id: string }) {
  return <span className={`net-dot net-${id}`} aria-hidden />;
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && <div className="card-head">{typeof title === 'string' ? <h2>{title}</h2> : title}{actions}</div>}
      {children}
    </section>
  );
}

export function Diag({ level, children }: { level: 'error' | 'warn' | 'info'; children: ReactNode }) {
  const ico = level === 'error' ? '!' : level === 'warn' ? '▲' : 'i';
  return <div className={`diag diag-${level}`}><span className="ico">{ico}</span><span>{children}</span></div>;
}

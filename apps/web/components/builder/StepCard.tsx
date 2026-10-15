import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

/** One frame for every builder step, so templates, networks, clients and add-ons read as one flow. */
export function StepCard({ n, title, done = false, value, actions, children, id }: {
  n: number; title: string; done?: boolean; value?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string;
}) {
  return (
    <section className="card" id={id} aria-labelledby={`${id ?? `step-${n}`}-title`}>
      <header className="step-head">
        <span className={`step-num ${done ? 'done' : ''}`} aria-hidden>{done ? <Check strokeWidth={3} /> : n}</span>
        <h2 className="step-title" id={`${id ?? `step-${n}`}-title`}>{title}</h2>
        {value && <div className="step-value">{value}</div>}
        {actions && <div style={{ marginLeft: value ? 0 : 'auto' }}>{actions}</div>}
      </header>
      {children}
    </section>
  );
}

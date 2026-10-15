/**
 * Loading indicator: three layers dropping onto a stack, the stakestack motif. Announces its label to
 * screen readers; with reduced motion the layers stay still and only the label shows progress.
 */
export function Loader({ label, sub, size = 'md' }: { label?: string; sub?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={`loader loader-${size}`} role="status" aria-live="polite">
      <div className="loader-stack" aria-hidden>
        <span /><span /><span />
      </div>
      {label && <div className="loader-label">{label}</div>}
      {sub && <div className="loader-sub">{sub}</div>}
    </div>
  );
}

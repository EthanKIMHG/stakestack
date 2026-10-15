/**
 * stakestack wears the Parataxis mark: a white Λ on a black square. The path is traced from the
 * brand asset (public/brand/parataxis-mark.svg holds the same drawing) so it stays sharp at any size.
 */
export const MARK_PATH = 'M100 42 156.95 145h-23.31L100 82.2 66.36 145H43.05z';

export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden className={`brand-mark ${className}`} style={{ borderRadius: Math.max(5, Math.round(size * 0.24)) }}>
      <rect width="200" height="200" fill="#000" />
      <path d={MARK_PATH} fill="#fff" />
    </svg>
  );
}

export function BrandLockup({ size = 28 }: { size?: number }) {
  return (
    <>
      <BrandMark size={size} />
      <span className="brand-name">stakestack</span>
    </>
  );
}

import type { ComponentLogo } from '@stakestack/shared/types';

const TINTS = ['#e8eeff', '#e6f2ec', '#f7eeda', '#fbe9e8', '#efe9ff', '#e3f5f9', '#f2ecf6', '#eef1f6'];

function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').split(/[\s\-_.]+/).filter(Boolean);
  const s = words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2);
  return s.toUpperCase();
}
function tint(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

/**
 * Square logo tile. Logos sit on white in both themes, like app icons, so marks drawn for light
 * backgrounds stay legible. Components without a file get a monogram (see docs/LOGOS.md).
 */
export function Logo({ logo, name, size = 36, className = '' }: { logo?: ComponentLogo; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.26) };
  if (!logo) {
    return (
      <span className={`logo mono-tile ${className}`} style={{ ...style, background: tint(name), fontSize: Math.round(size * 0.36) }} aria-hidden>
        {initials(name)}
      </span>
    );
  }
  return (
    <span className={`logo ${logo.bleed ? 'bleed' : ''} ${className}`} style={style} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="" width={size} height={size} loading="lazy" decoding="async" />
    </span>
  );
}

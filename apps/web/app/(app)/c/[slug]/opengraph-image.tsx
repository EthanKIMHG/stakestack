import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { MARK_PATH } from '@/components/Brand';
import { getCatalog } from '@/lib/catalog';

export const alt = 'Client releases and hard fork readiness on stakestack';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The component's logo file as a data URI, or null (no logo, or a format Satori cannot draw). */
function logoData(src: string | undefined): string | null {
  if (!src) return null;
  const type = src.endsWith('.svg') ? 'image/svg+xml' : src.endsWith('.png') ? 'image/png' : null;
  if (!type) return null;
  try { return `data:${type};base64,${readFileSync(join(process.cwd(), 'public', src)).toString('base64')}`; } catch { return null; }
}

/** Share card for /c/[slug]: the component's logo and name on the stakestack navy. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.components.find(x => x.slug === slug);
  const name = c?.name ?? slug;
  const logo = logoData(c?.logo?.src);
  const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: 'radial-gradient(120% 90% at 85% 10%, #2c3560 0%, #21273f 45%, #161b2e 100%)', color: '#f9fafc', fontFamily: 'sans-serif', position: 'relative' }}>
        <svg width="560" height="560" viewBox="0 0 200 200" style={{ position: 'absolute', right: -40, bottom: -150, opacity: 0.07 }}><path d={MARK_PATH} fill="#fff" /></svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="44" height="44" viewBox="0 0 200 200" style={{ borderRadius: 11 }}><rect width="200" height="200" fill="#000" /><path d={MARK_PATH} fill="#fff" /></svg>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8 }}>stakestack</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ width: 168, height: 168, borderRadius: 40, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logo} width={c?.logo?.bleed ? 168 : 124} height={c?.logo?.bleed ? 168 : 124} alt="" style={{ objectFit: c?.logo?.bleed ? 'cover' : 'contain' }} />
              : <div style={{ fontSize: 64, fontWeight: 700, color: '#21273f' }}>{initials}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 780 }}>
            <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
            {c?.vendor && <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.68)' }}>{c.vendor}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#c4d3fe' }}>Releases rated by severity · hard fork readiness</div>
      </div>
    ),
    size,
  );
}

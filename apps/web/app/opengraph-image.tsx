import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { MARK_PATH } from '@/components/Brand';

export const alt = 'stakestack: Ethereum staking stack builder and client release tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LOGOS = ['geth.png', 'nethermind.png', 'reth.png', 'lighthouse.png', 'teku.png', 'lodestar.png', 'obol.png', 'ssv.png', 'flashbots.png', 'web3signer.png'];

function dataUri(file: string): string | null {
  try { return `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/logos', file)).toString('base64')}`; } catch { return null; }
}

export default function OgImage() {
  const logos = LOGOS.map(dataUri).filter((x): x is string => !!x);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: 'radial-gradient(120% 90% at 85% 10%, #2c3560 0%, #21273f 45%, #161b2e 100%)', color: '#f9fafc', fontFamily: 'sans-serif', position: 'relative' }}>
        <svg width="560" height="560" viewBox="0 0 200 200" style={{ position: 'absolute', right: -40, bottom: -150, opacity: 0.07 }}><path d={MARK_PATH} fill="#fff" /></svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 200 200" style={{ borderRadius: 14 }}><rect width="200" height="200" fill="#000" /><path d={MARK_PATH} fill="#fff" /></svg>
          <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1 }}>stakestack</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2.5 }}>
            <span>Your staking stack,</span>
            <span style={{ color: '#c4d3fe' }}>always fork-ready.</span>
          </div>
          <div style={{ fontSize: 27, color: 'rgba(255,255,255,0.7)' }}>Severity-rated releases · fork readiness, Sepolia to Mainnet · DVT clusters</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {logos.map((src, i) => (
            <div key={i} style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} width={48} height={48} alt="" />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

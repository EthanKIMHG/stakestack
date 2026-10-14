import { ImageResponse } from 'next/og';

export const alt = 'stakestack: Ethereum staking stack builder and client release tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  const pills = ['Geth', 'Nethermind', 'Reth', 'Lighthouse', 'Teku', 'Prysm', 'Obol Charon', 'SSV', 'MEV-Boost', 'Web3Signer'];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: 'linear-gradient(135deg, #0b0e14 0%, #151b2b 60%, #1b1f4a 100%)', color: '#e8ecf3', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #4f46e5, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>S</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>stakestack</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>Every Ethereum staking release that matters, for your exact stack.</div>
          <div style={{ fontSize: 28, color: '#a7b0c0' }}>Severity-rated client releases · fork readiness for Sepolia, Hoodi and Mainnet · DVT cluster builder</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {pills.map(p => <div key={p} style={{ padding: '8px 16px', borderRadius: 999, background: '#1f2737', border: '1px solid #313c51', fontSize: 22, color: '#c9d1de' }}>{p}</div>)}
        </div>
      </div>
    ),
    size,
  );
}

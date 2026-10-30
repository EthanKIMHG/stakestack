const FALLBACK = 'https://stakestack-eth.vercel.app';

/** Accepts "example.com", "https://example.com/" or junk; returns an absolute origin or null. */
export function normalizeUrl(raw: string | undefined | null): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.origin;
  } catch {
    return null;
  }
}

/** Canonical site URL for metadata, sitemap and feeds. Never throws, so a bad env value cannot break the build. */
export function siteUrl(): string {
  const explicit = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit && !explicit.includes('localhost')) return explicit;
  const prod = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (prod) return prod;
  return explicit ?? FALLBACK;
}

export const SITE_NAME = 'stakestack';
export const SITE_TITLE = 'stakestack: Ethereum staking stack builder and client release tracker';
export const SITE_DESCRIPTION =
  'Open-source tool for Ethereum validator operators. Compose your execution, consensus and validator clients, DVT (Obol Charon, SSV), MEV-Boost and Web3Signer stack, then get severity-rated releases and hard fork readiness for Sepolia, Hoodi and Mainnet.';
export const SITE_KEYWORDS = [
  'ethereum staking', 'ethereum validator', 'validator client', 'consensus client', 'execution client', 'node operator',
  'client diversity', 'hard fork', 'glamsterdam', 'fusaka', 'hoodi', 'sepolia', 'release tracker', 'client releases',
  'dvt', 'distributed validator', 'obol', 'charon', 'ssv network', 'mev-boost', 'web3signer',
  'geth', 'nethermind', 'besu', 'reth', 'erigon', 'lighthouse', 'prysm', 'teku', 'nimbus', 'lodestar', 'grandine',
  'lido csm', 'rocket pool', 'eth-docker',
];
export const CONTACT_EMAIL = 'kimhg@parataxiseth.co.kr';
export const REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL || 'https://github.com/EthanKIMHG/stakestack';

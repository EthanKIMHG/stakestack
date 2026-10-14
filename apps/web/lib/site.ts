/** Canonical site URL for metadata, sitemap and feeds. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && !explicit.includes('localhost')) return explicit.replace(/\/$/, '');
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return explicit?.replace(/\/$/, '') || 'https://stakestack-eth.vercel.app';
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
export const REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL || 'https://github.com/kimhg2/stakestack';

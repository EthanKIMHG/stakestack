import { ArrowRight, ArrowUpRight, Blocks, Network, ShieldAlert, Waves } from 'lucide-react';
import { PRESETS } from '@stakestack/shared/presets';
import type { Catalog, Component } from '@stakestack/shared/types';
import { getCatalog, currentWave } from '@/lib/catalog';
import { JsonLd } from '@/components/JsonLd';
import { Logo } from '@/components/Logo';
import { MARK_PATH } from '@/components/Brand';
import { GitHubIcon } from '@/components/icons';
import { WaveProgress } from '@/components/WaveProgress';
import { SeverityBadge } from '@/components/ui';
import { relative, waveName } from '@/lib/format';
import { REPO_URL, SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

export const revalidate = 300;

const HERO_LAYERS = [
  { label: 'EL', slugs: ['geth', 'nethermind', 'besu', 'erigon', 'reth'], top: '6%', shift: -26 },
  { label: 'CL · VC', slugs: ['lighthouse', 'prysm', 'teku', 'nimbus-eth2', 'lodestar'], top: '37%', shift: 22 },
  { label: 'DVT · MEV · SIGNER', slugs: ['charon', 'ssv-node', 'mev-boost', 'web3signer', 'lido-csm'], top: '68%', shift: -8 },
];
const ROLE_ORDER = ['execution', 'consensus', 'validator', 'dvt', 'mev', 'remote-signer', 'protocol', 'node-manager', 'monitoring', 'key-tooling'];

/** Next scheduled activation on any network, for the hero's live line. */
function nextActivation(catalog: Catalog, now = Date.now()) {
  return catalog.upgrades
    .filter(u => u.activation_time && new Date(u.activation_time).getTime() > now && u.status !== 'cancelled' && u.status !== 'draft')
    .sort((a, b) => a.activation_time!.localeCompare(b.activation_time!))[0] ?? null;
}

export default async function Landing() {
  const catalog = await getCatalog();
  const bySlug = new Map(catalog.components.map(c => [c.slug, c]));
  const wave = currentWave(catalog);
  const next = nextActivation(catalog);
  const nextNet = next ? catalog.networks.find(n => n.id === next.network)?.name ?? next.network : null;
  const clients = catalog.components.filter(c => c.roles.some(r => r === 'execution' || r === 'consensus' || r === 'validator')).length;
  const networks = catalog.networks.filter(n => !n.deprecated).length;
  // One tile per logo: Obol, Lido, Flashbots and friends each ship several components.
  const seen = new Set<string>();
  const wall = catalog.components
    .filter(c => c.logo && c.status !== 'deprecated' && c.status !== 'archived' && !c.roles.includes('spec') && !c.roles.includes('network-config'))
    .sort((a, b) => roleRank(a) - roleRank(b) || (b.priority_weight ?? 1) - (a.priority_weight ?? 1))
    .filter(c => !seen.has(c.logo!.src) && !!seen.add(c.logo!.src))
    .slice(0, 28);
  const obol = PRESETS.find(p => p.id === 'obol-4');

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: SITE_NAME, url: siteUrl(), description: SITE_DESCRIPTION },
          { '@type': 'SoftwareApplication', name: SITE_NAME, applicationCategory: 'DeveloperApplication', operatingSystem: 'Web', url: siteUrl(),
            description: SITE_DESCRIPTION, isAccessibleForFree: true, license: 'https://opensource.org/licenses/MIT', codeRepository: REPO_URL,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
        ],
      }} />

      {/* ------------------------------------------------------------ hero */}
      <section className="lp-hero" aria-labelledby="hero-title">
        <HeroShapes />
        <div className="lp-hero-copy">
          <span className="lp-kicker">
            <i aria-hidden />
            {next ? `${waveName(next.wave)} on ${nextNet} ${relative(next.activation_time)}` : 'Open source · Ethereum staking'}
          </span>
          <h1 id="hero-title" className="lp-display">Your staking stack,<br /><em>always fork-ready.</em></h1>
          <p className="lp-lead">Pick your clients, DVT and sidecars. stakestack rates every release and shows what each network needs before the fork.</p>
          <div className="lp-actions">
            <a href="/build" className="lp-btn-light">Launch stakestack<span className="arrow"><ArrowUpRight aria-hidden /></span></a>
            <a href={REPO_URL} className="lp-btn-line" target="_blank" rel="noreferrer"><GitHubIcon size={17} />GitHub</a>
          </div>
        </div>
        <div className="lp-stack" aria-hidden>
          {HERO_LAYERS.map(l => (
            <div key={l.label} className="lp-layer" style={{ top: l.top, marginLeft: l.shift }}>
              <span className="lp-layer-label">{l.label}</span>
              {l.slugs.map(s => { const c = bySlug.get(s); return <Logo key={s} logo={c?.logo} name={c?.name ?? s} size={48} />; })}
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- statement */}
      <section className="lp-section lp-statement">
        <h2 className="lp-h1 reveal-ink">Staking runs on a dozen moving parts.<br /><span className="dim">Each ships on its own schedule.</span></h2>
        <p className="lp-p reveal">
          Execution, consensus and validator clients, DVT middleware, MEV sidecars and signers all release independently.
          Miss one mandatory upgrade before a fork and your validators miss their duties.
        </p>
        <div className="lp-stats reveal">
          <div className="lp-stat"><b>{catalog.components.length}</b><span>components tracked</span></div>
          <div className="lp-stat"><b>{clients}</b><span>EL, CL and VC clients</span></div>
          <div className="lp-stat"><b>{networks}</b><span>networks</span></div>
          <div className="lp-stat"><b>30 min</b><span>release refresh</span></div>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="lp-section" id="features" aria-labelledby="features-title">
        <div className="lp-section-head">
          <h2 id="features-title" className="lp-h2">What it does.</h2>
          <p>One page for the stack you run: what is in it, what changed, and what each fork requires.</p>
        </div>
        <div className="lp-features">
          <article className="lp-feature reveal">
            <span className="lp-feature-icon"><Blocks aria-hidden /></span>
            <h3>Build your stack</h3>
            <p>Pick EL, CL and VC clients, DVT, MEV, signers and protocol sidecars. Compatibility rules run as you pick.</p>
            <div className="lp-feature-visual" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['geth', 'nethermind', 'reth', 'lighthouse', 'teku', 'prysm', 'charon', 'mev-boost', 'web3signer'].map(s => { const c = bySlug.get(s); return <Logo key={s} logo={c?.logo} name={c?.name ?? s} size={36} />; })}
            </div>
          </article>
          <article className="lp-feature reveal">
            <span className="lp-feature-icon"><ShieldAlert aria-hidden /></span>
            <h3>Severity-rated releases</h3>
            <p>Every release note is scored with the lines that triggered the rating, so you know what to upgrade first.</p>
            <div className="lp-feature-visual" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['critical', 'high', 'recommended', 'optional'].map(s => <SeverityBadge key={s} severity={s} />)}
            </div>
          </article>
          <article className="lp-feature reveal">
            <span className="lp-feature-icon"><Waves aria-hidden /></span>
            <h3>Fork readiness</h3>
            <p>Minimum versions per network, Sepolia to Hoodi to Mainnet, checked against what your clients have shipped.</p>
            {wave && <div className="lp-feature-visual"><div className="eyebrow" style={{ marginBottom: 12 }}>{wave.name} · live</div><WaveProgress catalog={catalog} wave={wave} compact /></div>}
          </article>
          <article className="lp-feature reveal">
            <span className="lp-feature-icon"><Network aria-hidden /></span>
            <h3>DVT clusters</h3>
            <p>Run a different client pair on every node. Threshold, fault tolerance and client concentration are checked live.</p>
            {obol?.topology && (
              <div className="lp-feature-visual" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {obol.topology.nodes.map((n, i) => (
                  <div key={i} style={{ display: 'grid', justifyItems: 'center', gap: 6, padding: '10px 6px', borderRadius: 12, background: 'var(--color-inset)', boxShadow: 'inset 0 0 0 1px var(--color-line)' }}>
                    <span className="meta" style={{ fontWeight: 600 }}>node {i + 1}</span>
                    <span className="logo-stack">
                      {[n.execution, n.consensus].map(s => { const c = bySlug.get(s ?? ''); return <Logo key={s} logo={c?.logo} name={c?.name ?? s ?? '?'} size={28} />; })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------------- why */}
      <section className="lp-section" id="why" aria-labelledby="why-title">
        <div className="lp-why">
          <h2 id="why-title" className="lp-h1 reveal-ink" style={{ maxWidth: 760 }}>Why stakestack.</h2>
          <div className="lp-why-grid">
            <div className="lp-why-item reveal">
              <span className="n">01</span>
              <h3>Release notes are scattered.</h3>
              <p>{catalog.components.length} repositories, each with its own format and cadence. stakestack reads them for you and keeps the evidence.</p>
            </div>
            <div className="lp-why-item reveal">
              <span className="n">02</span>
              <h3>Forks don&apos;t wait.</h3>
              <p>Each upgrade lands on Sepolia, then Hoodi, then Mainnet. Know the minimum version before the epoch, not after.</p>
            </div>
            <div className="lp-why-item reveal">
              <span className="n">03</span>
              <h3>Diversity is safety.</h3>
              <p>A bug in a majority client can take most of the network with it. Checks flag client concentration across your nodes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section className="lp-section" id="how" aria-labelledby="how-title">
        <div className="lp-section-head">
          <h2 id="how-title" className="lp-h2">How it works.</h2>
          <p>No account. Your draft stays in the browser until you save it.</p>
        </div>
        <div className="lp-steps">
          <div className="lp-step reveal"><span className="n">1</span><h3>Pick</h3><p>Start from a template or choose each component yourself.</p></div>
          <div className="lp-step reveal"><span className="n">2</span><h3>Check</h3><p>See conflicts, warnings and fork readiness for every network.</p></div>
          <div className="lp-step reveal"><span className="n">3</span><h3>Follow</h3><p>Save the stack and subscribe to its RSS or JSON release feed.</p></div>
        </div>
      </section>

      {/* ----------------------------------------------------------- logos */}
      <section className="lp-section" aria-labelledby="logos-title">
        <div className="lp-section-head">
          <h2 id="logos-title" className="lp-h2">Tracks the software you run.</h2>
          <a href="/build" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>See all {catalog.components.length}<ArrowRight aria-hidden width={16} height={16} /></a>
        </div>
        <div className="lp-logos">
          {wall.map(c => <a key={c.slug} href={`/c/${c.slug}`} className="lp-logo" title={c.name}><Logo logo={c.logo} name={c.name} size={28} /><span>{shortName(c)}</span></a>)}
        </div>
      </section>

      {/* ----------------------------------------------------------- final */}
      <section className="lp-final">
        <h2 className="lp-h1 reveal-ink">Build your stack.</h2>
        <div className="lp-actions">
          <a href="/build" className="lp-btn-light">Launch stakestack<span className="arrow"><ArrowUpRight aria-hidden /></span></a>
        </div>
      </section>
    </>
  );
}

function roleRank(c: Component): number {
  const i = Math.min(...c.roles.map(r => { const k = ROLE_ORDER.indexOf(r); return k < 0 ? 99 : k; }));
  return i;
}
const WALL_LABEL: Record<string, string> = {
  charon: 'Obol Charon', 'lido-csm': 'Lido CSM', 'rocketpool-smartnode': 'Rocket Pool', 'stakewise-v3-operator': 'StakeWise',
  'eigenlayer-cli': 'EigenLayer', hyperdrive: 'NodeSet', 'puffer-coral': 'Puffer', 'ethereum-metrics-exporter': 'ethPandaOps',
  'beaconchain-explorer': 'beaconcha.in', 'eth-validator-watcher': 'Kiln watcher',
};
function shortName(c: Component): string {
  return WALL_LABEL[c.slug] ?? c.name.replace(/\s*\(.*\)$/, '');
}

/** Parataxis shapes: the Λ mark at scale and a blue wedge, as in the brand imagery. */
function HeroShapes() {
  return (
    <svg className="lp-hero-shapes" viewBox="0 0 1200 680" preserveAspectRatio="xMaxYMax slice" aria-hidden>
      <g transform="translate(560 40) scale(5.6)" opacity="0.07"><path d={MARK_PATH} fill="#fff" /></g>
      <path d="M1000 720 1175 418 1350 720z" fill="#678bff" stroke="#678bff" strokeWidth="36" strokeLinejoin="round" opacity="0.9" />
      <path d="M760 720 935 418 1110 720z" fill="none" stroke="#c4d3fe" strokeOpacity="0.18" strokeWidth="2" />
    </svg>
  );
}

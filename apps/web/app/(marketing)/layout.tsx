import { ArrowUpRight } from 'lucide-react';
import { BrandLockup, BrandMark } from '@/components/Brand';
import { GitHubIcon } from '@/components/icons';
import { CONTACT_EMAIL, REPO_URL } from '@/lib/site';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="wrap lp-header-inner">
          <a href="/" className="brand" aria-label="stakestack home"><BrandLockup size={30} /></a>
          <nav className="lp-nav" aria-label="Landing">
            <a href="#features">Features</a>
            <a href="#why">Why</a>
            <a href="#how">How it works</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="lp-nav-gh"><GitHubIcon size={15} />GitHub</a>
            <a href="/build" className="lp-cta-dark">Launch app<ArrowUpRight aria-hidden /></a>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="lp-footer">
        <div className="wrap lp-footer-inner">
          <div className="lp-wordmark"><BrandMark size={48} />stakestack</div>
          <nav aria-label="Footer">
            <a href="/build">Build</a>
            <a href="/upgrades">Fork waves</a>
            <a href="/releases">Releases</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          </nav>
          <div className="lp-legal">
            <span>Open source under the MIT license · by Parataxis</span>
            <span>Ratings are rule-based. Always read the release notes before upgrading production validators.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

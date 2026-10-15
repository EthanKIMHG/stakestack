import { NavLinks } from '@/components/NavLinks';
import { UtcClock } from '@/components/UtcClock';
import { BrandLockup } from '@/components/Brand';
import { GitHubIcon } from '@/components/icons';
import { AccountButton } from '@/components/auth/AccountButton';
import { AuthLoader } from '@/components/auth/AuthLoader';
import { REPO_URL } from '@/lib/site';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <div className="wrap app-header-inner">
          <a href="/" className="brand" aria-label="stakestack home"><BrandLockup size={28} /></a>
          <div className="header-right">
            <UtcClock />
            <span className="nav-sep" aria-hidden />
            <NavLinks />
            <a href={REPO_URL} className="nav-link nav-github" target="_blank" rel="noreferrer" title="GitHub"><GitHubIcon /><span className="sr-only">GitHub</span></a>
            <AccountButton />
          </div>
        </div>
      </header>
      <main className="wrap app-main">{children}</main>
      <footer className="app-footer">
        <div className="wrap app-footer-inner">
          <span>Ratings are rule-based and show their evidence. Read release notes before upgrading.</span>
          <span>Open source · MIT · <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a></span>
        </div>
      </footer>
      <AuthLoader />
    </>
  );
}

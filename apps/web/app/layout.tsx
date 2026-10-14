import type { Metadata } from 'next';
import { NavLinks } from '@/components/NavLinks';
import './globals.css';

export const metadata: Metadata = {
  title: 'stakestack',
  description: 'Compose an Ethereum staking stack and track every release and fork that matters, per network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="site-header">
          <nav className="container">
            <a href="/" className="brand"><span className="brand-mark">S</span>stakestack</a>
            <NavLinks />
            <a href={process.env.NEXT_PUBLIC_GITHUB_REPO_URL ?? 'https://github.com/kimhg2/stakestack'} className="nav-link nav-github" style={{ marginLeft: "auto" }} target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
        </header>
        <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>{children}</main>
        <footer className="container faint" style={{ fontSize: 12.5, paddingBottom: 32 }}>
          Severity ratings are rule-based and always show their evidence. Read the release notes before upgrading production validators.
          Fork dates come from Ethereum Foundation announcements; tentative dates are marked.
        </footer>
      </body>
    </html>
  );
}

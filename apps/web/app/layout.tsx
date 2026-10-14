import type { Metadata, Viewport } from 'next';
import { NavLinks } from '@/components/NavLinks';
import { REPO_URL, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, siteUrl } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  category: 'technology',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: SITE_NAME, url: '/', title: SITE_TITLE, description: SITE_DESCRIPTION, locale: 'en_US' },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f6f7f9' }, { media: '(prefers-color-scheme: dark)', color: '#0b0e14' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="site-header">
          <nav className="container">
            <a href="/" className="brand"><span className="brand-mark">S</span>stakestack</a>
            <NavLinks />
            <a href={REPO_URL} className="nav-link nav-github" style={{ marginLeft: "auto" }} target="_blank" rel="noreferrer">GitHub ↗</a>
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

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'stakestack',
  description: 'Compose an Ethereum staking stack and track every release that matters, per network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b" style={{ borderColor: 'var(--line)' }}>
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <a href="/" className="font-bold tracking-tight" style={{ color: 'var(--fg)' }}>stakestack</a>
            <a href="/build">Build a stack</a>
            <a href="/upgrades">Upgrades</a>
            <a href={process.env.NEXT_PUBLIC_GITHUB_REPO_URL ?? '#'} className="ml-auto" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs" style={{ color: 'var(--muted)' }}>
          Assessments are rule-based and show their evidence. Always read the release notes before upgrading production validators.
        </footer>
      </body>
    </html>
  );
}

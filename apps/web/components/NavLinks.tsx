'use client';
import { usePathname } from 'next/navigation';
import { Blocks, Tag, Waves } from 'lucide-react';

const LINKS = [
  { href: '/build', label: 'Build', icon: Blocks },
  { href: '/upgrades', label: 'Fork waves', icon: Waves },
  { href: '/releases', label: 'Releases', icon: Tag },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <a key={href} href={href} className="nav-link" aria-current={path?.startsWith(href) ? 'page' : undefined} title={label}>
          <Icon aria-hidden /><span className="label">{label}</span>
        </a>
      ))}
    </nav>
  );
}

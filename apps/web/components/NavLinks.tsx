'use client';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/build', label: 'Build a stack' },
  { href: '/upgrades', label: 'Fork waves' },
  { href: '/releases', label: 'Releases' },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {LINKS.map(l => (
        <a key={l.href} href={l.href} className="nav-link" aria-current={path?.startsWith(l.href) ? 'page' : undefined}>{l.label}</a>
      ))}
    </>
  );
}

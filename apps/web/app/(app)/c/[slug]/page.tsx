import { notFound } from 'next/navigation';
import { BookOpen, Globe, Package } from 'lucide-react';
import { getCatalog, getTimeline } from '@/lib/catalog';
import { ReleaseList } from '@/components/ReleaseList';
import { Card, NetDot, Pill } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { GitHubIcon } from '@/components/icons';
import { JsonLd } from '@/components/JsonLd';
import { siteUrl } from '@/lib/site';
import { waveName } from '@/lib/format';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.components.find(x => x.slug === slug);
  if (!c) return { title: 'Component not found', robots: { index: false } };
  const rows = await getTimeline({ network: ['mainnet'], any: [slug] }, 5);
  const latest = rows[0];
  const req = catalog.upgrades.filter(u => u.required_versions?.[slug]).sort((a, b) => (b.activation_time ?? '').localeCompare(a.activation_time ?? ''))[0];
  const parts = [
    c.summary,
    latest ? `Latest stable release ${latest.tag} (${latest.severity}).` : null,
    req ? `${req.wave[0]!.toUpperCase()}${req.wave.slice(1)} on ${req.network} requires ${c.name} >= ${req.required_versions[slug]}.` : null,
  ].filter(Boolean);
  const title = `${c.name} releases and hard fork readiness`;
  const description = parts.join(' ').slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: `/c/${slug}` },
    openGraph: { title, description, url: `/c/${slug}`, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export const revalidate = 300;

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.components.find(x => x.slug === slug);
  if (!c) notFound();
  const rows = await getTimeline({ network: ['hoodi'], any: [slug] }, 80);
  const required = catalog.upgrades.filter(u => u.required_versions?.[slug]).sort((a, b) => (b.activation_time ?? '').localeCompare(a.activation_time ?? ''));
  const netName = (id: string) => catalog.networks.find(n => n.id === id)?.name ?? id;
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: c.name,
        description: c.summary,
        codeRepository: `https://github.com/${c.repo}`,
        programmingLanguage: c.language,
        license: c.license,
        author: c.vendor ? { '@type': 'Organization', name: c.vendor } : undefined,
        url: `${siteUrl()}/c/${c.slug}`,
        ...(rows.find(r => !r.is_prerelease) ? { version: rows.find(r => !r.is_prerelease)!.tag } : {}),
      }} />
      <section className="card card-body comp-hero">
        <Logo logo={c.logo} name={c.name} size={64} />
        <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 className="page-title">{c.name}</h1>
            {c.status !== 'active' && <Pill tone="flag">{c.status}</Pill>}
          </div>
          <div className="muted">{[c.vendor, c.language, c.license].filter(Boolean).join(' · ')}</div>
          {c.summary && <p style={{ maxWidth: 720 }}>{c.summary}</p>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {c.roles.map(r => <Pill key={r} tone="accent">{r}</Pill>)}
            {(c.networks ?? []).map(n => <Pill key={n}><NetDot id={n} />{netName(n)}</Pill>)}
          </div>
          <div className="comp-links" style={{ marginTop: 4 }}>
            <a className="btn btn-sm" href={`https://github.com/${c.repo}`} target="_blank" rel="noreferrer"><GitHubIcon size={14} />{c.repo}</a>
            {c.docs && <a className="btn btn-sm" href={c.docs} target="_blank" rel="noreferrer"><BookOpen aria-hidden />Docs</a>}
            {c.homepage && <a className="btn btn-sm" href={c.homepage} target="_blank" rel="noreferrer"><Globe aria-hidden />Website</a>}
            {c.docker_image && <span className="pill" style={{ height: 32, padding: '0 10px' }}><Package aria-hidden /><span className="mono" style={{ fontSize: 12 }}>{c.docker_image}</span></span>}
          </div>
          {c.notes && <p className="meta" style={{ fontSize: 13 }}>{c.notes}</p>}
        </div>
      </section>
      {required.length > 0 && (
        <Card title="Required by network upgrades">
          <div className="scroll-x">
            <table className="matrix">
              <thead><tr><th>Upgrade</th><th>Network</th><th>Minimum</th></tr></thead>
              <tbody>{required.map(u => <tr key={u.id}><td>{waveName(u.wave)}</td><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><NetDot id={u.network} />{netName(u.network)}</span></td><td className="v">≥ {u.required_versions[slug]}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
      <Card title={<div><h2>Releases</h2><span className="meta">Rated by the <span className="mono" style={{ fontSize: 12 }}>{c.assessor}</span> rules · weight {c.priority_weight ?? 1}</span></div>}>
        <ReleaseList rows={rows} linkComponents={false} facets={['sev', 'type', 'net', 'fork']} />
      </Card>
    </div>
  );
}

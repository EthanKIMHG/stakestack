import { siteUrl } from '@/lib/site';

/** Structured data for search engines. Content is built from our own constants and catalog, escaped for <script>. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

/** BreadcrumbList for Google's breadcrumb trail in results; `path` is site-relative. */
export function Breadcrumbs({ items }: { items: Array<{ name: string; path: string }> }) {
  const base = siteUrl();
  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'stakestack', path: '/' }, ...items].map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${base}${it.path === '/' ? '' : it.path}` })),
    }} />
  );
}

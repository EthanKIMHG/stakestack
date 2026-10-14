import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    // Saved stacks are user content and preview pages are query-string variants: keep them out of the index.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/s/'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

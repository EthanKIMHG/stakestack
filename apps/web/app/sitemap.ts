import type { MetadataRoute } from 'next';
import { getCatalog } from '@/lib/catalog';
import { siteUrl } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const catalog = await getCatalog();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/upgrades`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/releases`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${base}/build`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
  const components: MetadataRoute.Sitemap = catalog.components
    .filter(c => c.status !== 'archived')
    .map(c => {
      const pushed = (c as { repo_pushed_at?: string | null }).repo_pushed_at;
      return {
        url: `${base}/c/${c.slug}`,
        lastModified: pushed ? new Date(pushed) : now,
        changeFrequency: 'daily',
        priority: (c.priority_weight ?? 1) >= 1.3 ? 0.7 : 0.5,
      };
    });
  return [...pages, ...components];
}

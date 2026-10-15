# Search engines

What stakestack already does, and how to get it indexed.

## Built in

| | Where |
|---|---|
| Unique title, description and canonical URL per page; filtered `/releases?...` views canonicalise to `/releases` | page `metadata` / `generateMetadata` |
| `robots.txt`: everything allowed except `/api/` and saved stacks `/s/` (user content) | `apps/web/app/robots.ts` |
| `sitemap.xml`: home, build, releases, fork waves and every component page | `apps/web/app/sitemap.ts` |
| Structured data: WebSite + SoftwareApplication on `/`, SoftwareSourceCode on `/c/*`, BreadcrumbList on app pages | `components/JsonLd.tsx` |
| Share images: one for the site, one per component (logo + name) | `app/opengraph-image.tsx`, `app/(app)/c/[slug]/opengraph-image.tsx` |
| Web app manifest | `app/manifest.ts` |
| Ownership verification tags from env (Google, Naver, Bing) | `app/layout.tsx` |

Preview deployments on Vercel send `X-Robots-Tag: noindex`, so only production is indexed.

## Google Search Console

1. Open [search.google.com/search-console](https://search.google.com/search-console) › **Add property** ›
   **URL prefix** › `https://stakestack-eth.vercel.app/`.
   (A *Domain* property needs a DNS record, which `vercel.app` does not let you add. With a custom
   domain, prefer the Domain property.)
2. Choose **HTML tag** and copy only the `content` value from
   `<meta name="google-site-verification" content="…">`.
3. Vercel › Project › Settings › Environment Variables: `GOOGLE_SITE_VERIFICATION=<value>` for
   Production, then redeploy. Check that the tag is in the page source, then click **Verify**.
   Keep the variable: removing the tag can un-verify the property later.
4. **Sitemaps** › enter `sitemap.xml` › **Submit**.
5. **URL inspection** › paste `https://stakestack-eth.vercel.app/` › **Request indexing**. Repeat for
   `/build`, `/releases` and `/upgrades`; component pages are found through the sitemap.
6. Indexing usually takes a few days to a couple of weeks. Watch **Pages** for errors and
   **Performance** for queries.

## Other search engines (optional)

- **Bing / DuckDuckGo / Yahoo**: [Bing Webmaster Tools](https://www.bing.com/webmasters) can import the
  verified site and sitemap from Google Search Console in one step. If you verify by tag instead, set
  `BING_SITE_VERIFICATION`.
- **Naver** (Korean audience): [Naver Search Advisor](https://searchadvisor.naver.com) › add site ›
  HTML tag › `NAVER_SITE_VERIFICATION`; then submit `sitemap.xml` under 요청 › 사이트맵 제출.

## What moves the needle next

- A custom domain (for example `stakestack.xyz`): ranks better than a `vercel.app` subdomain and
  allows a Domain property. Update `NEXT_PUBLIC_SITE_URL` when you switch.
- Links in: set the GitHub repository's website field to the site, and link it from the README,
  EthStaker and client communities.
- Fresh content is already there: releases are ingested every 30 minutes and every component page
  updates with them.

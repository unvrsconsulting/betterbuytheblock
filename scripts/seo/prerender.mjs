#!/usr/bin/env node
// Runs after `vite build`. Writes real, crawlable static HTML files
// (dist/<route>/index.html) for every neighborhood/category/category-city/
// business page, plus dist/sitemap.xml — see the plan doc
// (~/.claude/plans/nested-tumbling-pnueli.md) for the full design.
//
// Vercel serves a matching static file before falling back to the SPA
// rewrite in vercel.json, so no server config changes are needed: these
// files just need to exist in dist/ at build time.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  SITE_URL,
  businessPath,
  neighborhoodPath,
  getBusinessPageContent,
  getNeighborhoodPageContent,
  getCategoryPageContent,
} from '../../services/seo/pageContent.js';
import { renderHead, renderPage, renderServiceCardHtml, renderBusinessCardHtml, escapeHtml } from './htmlTemplate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const DATA_DIR = path.join(DIST, 'data');

const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;
// Keep prerendered pages a reasonable size — the live SPA shows the full set
// once JS hydrates; the static page's job is real, substantive content for a
// crawler, not literally every row of a 300-item listing.
const MAX_CARDS_PER_PAGE = 60;

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, relPath), 'utf-8'));
}

function readRepoJson(relPath) {
  return JSON.parse(readFileSync(path.join(ROOT, relPath), 'utf-8'));
}

const CATEGORY_GROUPS = readRepoJson('constants/categoryGroups.json');
// The SAME fixed city list the client uses to build its slug map (see
// constants.ts WAKE_COUNTY_CITIES / services/seo/slugify.js) — using any
// other city list here would generate URLs the client can't resolve back to
// a canonical city name.
const WAKE_COUNTY_CITIES = readRepoJson('constants/cities.json');

function writeRoute(routePath, html) {
  const dir = path.join(DIST, routePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), html);
}

function main() {
  if (!require_exists(path.join(DIST, 'index.html'))) {
    console.error('scripts/seo/prerender.mjs: dist/index.html not found — run `vite build` first.');
    process.exit(1);
  }

  const indexHtml = readFileSync(path.join(DIST, 'index.html'), 'utf-8');
  const scriptMatch = indexHtml.match(/<script type="module"[^>]*><\/script>/);
  const cssMatch = indexHtml.match(/<link rel="stylesheet"[^>]*>/);
  if (!scriptMatch || !cssMatch) {
    console.error('scripts/seo/prerender.mjs: could not find built <script>/<link> tags in dist/index.html.');
    process.exit(1);
  }
  const assetTags = `${scriptMatch[0]}\n    ${cssMatch[0]}`;

  const neighborhoodsRaw = readJson('wake-neighborhoods.json');
  const statsFile = readJson('wake-neighborhood-stats.json');
  const businesses = readJson('seed-businesses.json');
  const services = readJson('seed-services.json');

  // Same merge services/neighborhoods.ts does client-side, replicated here
  // since this script runs under plain Node, not through that TS module.
  const realStats = statsFile.neighborhoods || {};
  const neighborhoods = neighborhoodsRaw.map(n => ({ ...n, homeStats: realStats[n.id] }));

  const allCategories = CATEGORY_GROUPS.flatMap(g => g.categories);

  let counts = { category: 0, categoryCity: 0, neighborhoodIndexed: 0, neighborhoodNoindex: 0, business: 0 };
  const sitemapUrls = [];

  function pageHtml({ title, description, canonicalUrl, robots, jsonLd, bodyHtml }) {
    const head = renderHead({
      title,
      description,
      canonicalUrl,
      robots,
      ogImage: DEFAULT_OG_IMAGE,
      jsonLdList: jsonLd,
      assetTags,
    });
    return renderPage({ head, bodyHtml });
  }

  function listingBody({ heading, intro, cardsHtml, count }) {
    return `<section style="max-width:1200px;margin:0 auto;padding:48px 24px;">
      <nav><a href="/" style="color:#059669;text-decoration:none;font-weight:600;">&larr; BetterBuyTheBlock</a></nav>
      <h1 style="font-size:32px;font-weight:800;color:#111827;margin:16px 0 8px;">${escapeHtml(heading)}</h1>
      <p style="color:#6b7280;max-width:640px;margin:0 0 32px;">${escapeHtml(intro)}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
        ${cardsHtml || '<p style="color:#9ca3af;">No listings here yet — check back soon.</p>'}
      </div>
      ${count > MAX_CARDS_PER_PAGE ? `<p style="color:#9ca3af;font-size:13px;margin-top:24px;">Showing ${MAX_CARDS_PER_PAGE} of ${count} — view the full list on the live site.</p>` : ''}
    </section>`;
  }

  // --- Category pages (23, always indexable) ---
  for (const categoryName of allCategories) {
    const content = getCategoryPageContent(categoryName, null, services);
    const cardsHtml = content.services
      .slice(0, MAX_CARDS_PER_PAGE)
      .map(s => renderServiceCardHtml(s, businesses.find(b => b.id === s.businessId), businessPath(businesses.find(b => b.id === s.businessId) || { id: s.businessId, name: s.businessId })))
      .join('\n        ');
    const bodyHtml = listingBody({
      heading: `${categoryName} in Wake County, NC`,
      intro: content.description,
      cardsHtml,
      count: content.services.length,
    });
    writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
    sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.8' });
    counts.category++;
  }

  // --- Category x City pages (only combos with >=1 real service) ---
  for (const categoryName of allCategories) {
    for (const cityName of WAKE_COUNTY_CITIES) {
      const content = getCategoryPageContent(categoryName, cityName, services);
      if (content.services.length === 0) continue; // never generate/link an empty combo
      const cardsHtml = content.services
        .slice(0, MAX_CARDS_PER_PAGE)
        .map(s => renderServiceCardHtml(s, businesses.find(b => b.id === s.businessId), businessPath(businesses.find(b => b.id === s.businessId) || { id: s.businessId, name: s.businessId })))
        .join('\n        ');
      const bodyHtml = listingBody({
        heading: `${categoryName} in ${cityName}, NC`,
        intro: content.description,
        cardsHtml,
        count: content.services.length,
      });
      writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
      sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.7' });
      counts.categoryCity++;
    }
  }

  // --- Neighborhood pages (all 4,990; indexable only with real GIS stats) ---
  for (const neighborhood of neighborhoods) {
    const scopedServices = services.filter(
      s => (s.neighborhoodIds || []).includes(neighborhood.id) || (s.servedCities || []).includes(neighborhood.city)
    );
    const content = getNeighborhoodPageContent(neighborhood, scopedServices);
    const statsHtml = content.statsSentence
      ? `<p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 16px;color:#4b5563;font-size:14px;max-width:640px;">${escapeHtml(content.statsSentence)}</p>`
      : '';
    const cardsHtml = scopedServices
      .slice(0, MAX_CARDS_PER_PAGE)
      .map(s => renderServiceCardHtml(s, businesses.find(b => b.id === s.businessId), businessPath(businesses.find(b => b.id === s.businessId) || { id: s.businessId, name: s.businessId })))
      .join('\n        ');
    const bodyHtml = `<section style="max-width:1200px;margin:0 auto;padding:48px 24px;">
      <nav><a href="/" style="color:#059669;text-decoration:none;font-weight:600;">&larr; BetterBuyTheBlock</a></nav>
      <h1 style="font-size:32px;font-weight:800;color:#111827;margin:16px 0 8px;">${escapeHtml(neighborhood.name)}, ${escapeHtml(neighborhood.city)} NC</h1>
      <div style="margin-bottom:24px;">${statsHtml}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
        ${cardsHtml || '<p style="color:#9ca3af;">No deals here yet — check back soon.</p>'}
      </div>
    </section>`;
    writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
    if (content.robots.startsWith('index')) {
      sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.5' });
      counts.neighborhoodIndexed++;
    } else {
      counts.neighborhoodNoindex++;
    }
  }

  // --- Business pages (1,644, all indexable per the confirmed decision) ---
  for (const business of businesses) {
    const ownServices = services.filter(s => s.businessId === business.id);
    const content = getBusinessPageContent(business, ownServices);
    const cardsHtml = ownServices
      .map(s => renderServiceCardHtml(s, business, content.path))
      .join('\n        ');
    const badgeHtml = content.honestyBadge
      ? `<div style="display:inline-block;background:#111827;color:#fff;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${escapeHtml(content.honestyBadge)}</div>`
      : '';
    const noteHtml = content.honestyNote
      ? `<p style="color:#6b7280;font-size:14px;max-width:640px;margin:0 0 16px;">${escapeHtml(content.honestyNote)}</p>`
      : '';
    const bodyHtml = `<section style="max-width:1200px;margin:0 auto;padding:48px 24px;">
      <nav><a href="/" style="color:#059669;text-decoration:none;font-weight:600;">&larr; BetterBuyTheBlock</a></nav>
      <h1 style="font-size:32px;font-weight:800;color:#111827;margin:16px 0 8px;">${escapeHtml(business.name)}</h1>
      ${badgeHtml}
      ${noteHtml}
      ${business.description ? `<p style="color:#374151;max-width:640px;margin:0 0 24px;">${escapeHtml(business.description)}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
        ${cardsHtml || '<p style="color:#9ca3af;">No current deals from this business.</p>'}
      </div>
    </section>`;
    writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
    sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.6' });
    counts.business++;
  }

  // --- Sitemap (replaces whatever public/sitemap.xml Vite already copied) ---
  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    { loc: `${SITE_URL}/privacy`, priority: '0.3' },
    { loc: `${SITE_URL}/terms`, priority: '0.3' },
  ];
  // Blog guide slugs are authored directly in App.tsx's COST_GUIDES, not
  // fetched data — read them out of the built client bundle would be fragile,
  // so this list is kept in sync by hand (small, rarely-changing set).
  const guideSlugs = [
    'hvac-costs-wake-county-2027',
    'roofing-costs-wake-county-2027',
    'lawn-care-landscaping-costs-wake-county-2027',
    'house-cleaning-costs-wake-county-2027',
    'pest-control-costs-wake-county-2027',
  ];
  for (const slug of guideSlugs) staticUrls.push({ loc: `${SITE_URL}/guides/${slug}`, priority: '0.7' });

  const allUrls = [...staticUrls, ...sitemapUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
  writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml);

  console.log('SEO prerender summary:');
  console.log(`  Category pages:        ${counts.category}`);
  console.log(`  Category x City pages: ${counts.categoryCity}`);
  console.log(`  Neighborhood pages:    ${counts.neighborhoodIndexed} indexed + ${counts.neighborhoodNoindex} noindex = ${counts.neighborhoodIndexed + counts.neighborhoodNoindex}`);
  console.log(`  Business pages:        ${counts.business}`);
  console.log(`  Total pages written:   ${counts.category + counts.categoryCity + counts.neighborhoodIndexed + counts.neighborhoodNoindex + counts.business}`);
  console.log(`  Sitemap entries:       ${allUrls.length}`);
}

function require_exists(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

main();

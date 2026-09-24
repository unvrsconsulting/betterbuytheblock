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
  servicePath,
  neighborhoodPath,
  categoryPath,
  categoryCityPath,
  guidePath,
  guideDateIso,
  GUIDES_HUB_PATH,
  describeInsights,
  getBusinessPageContent,
  getServicePageContent,
  getNeighborhoodPageContent,
  getCategoryPageContent,
  getGuidePageContent,
  getGuidesHubContent,
  getGuidesForCategory,
} from '../../services/seo/pageContent.js';
import { COST_GUIDES } from '../../services/seo/guides.js';
import {
  renderHead,
  renderPage,
  renderServiceCardHtml,
  renderBusinessCardHtml,
  renderGuideBodyHtml,
  renderGuidesHubBodyHtml,
  renderHomeBodyHtml,
  escapeHtml,
} from './htmlTemplate.mjs';

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
  const businessById = new Map(businesses.map(b => [b.id, b]));

  function hrefsFor(service) {
    const business = businessById.get(service.businessId);
    if (!business) return { businessHref: undefined, serviceHref: undefined };
    return { businessHref: businessPath(business), serviceHref: servicePath(business, service) };
  }

  let counts = { category: 0, categoryCity: 0, neighborhoodIndexed: 0, neighborhoodNoindex: 0, business: 0, service: 0, guide: 0 };
  const sitemapUrls = [];

  function pageHtml({ title, description, canonicalUrl, robots, jsonLd, bodyHtml, ogImage }) {
    const head = renderHead({
      title,
      description,
      canonicalUrl,
      robots,
      ogImage: ogImage || DEFAULT_OG_IMAGE,
      jsonLdList: jsonLd,
      assetTags,
    });
    return renderPage({ head, bodyHtml });
  }

  const NAV_LINK = 'color:#059669;text-decoration:none;font-weight:600;';
  function linkRow(title, links) {
    if (!links.length) return '';
    return `<div style="margin:24px 0 0;"><h2 style="font-size:16px;font-weight:800;color:#111827;margin:0 0 8px;">${escapeHtml(title)}</h2><p style="line-height:2;margin:0;">${links
      .map(l => `<a href="${escapeHtml(l.href)}" style="${NAV_LINK}margin-right:16px;white-space:nowrap;">${escapeHtml(l.label)}</a>`)
      .join(' ')}</p></div>`;
  }

  function listingBody({ heading, intro, cardsHtml, count, insightsHtml = '', extraHtml = '' }) {
    return `<section style="max-width:1200px;margin:0 auto;padding:48px 24px;">
      <nav><a href="/" style="color:#059669;text-decoration:none;font-weight:600;">&larr; BetterBuyTheBlock</a></nav>
      <h1 style="font-size:32px;font-weight:800;color:#111827;margin:16px 0 8px;">${escapeHtml(heading)}</h1>
      <p style="color:#6b7280;max-width:640px;margin:0 0 16px;">${escapeHtml(intro)}</p>
      ${insightsHtml}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:24px;">
        ${cardsHtml || '<p style="color:#9ca3af;">No listings here yet — check back soon.</p>'}
      </div>
      ${count > MAX_CARDS_PER_PAGE ? `<p style="color:#9ca3af;font-size:13px;margin-top:24px;">Showing ${MAX_CARDS_PER_PAGE} of ${count} — view the full list on the live site.</p>` : ''}
      ${extraHtml}
    </section>`;
  }

  // Which category x city combinations really have services - drives the
  // cross-links below so no page ever links to an empty/non-existent combo.
  const categoryGroupOf = new Map();
  CATEGORY_GROUPS.forEach(g => g.categories.forEach(c => categoryGroupOf.set(c, g)));
  const comboCounts = new Map();
  for (const categoryName of allCategories) {
    for (const cityName of WAKE_COUNTY_CITIES) {
      const n = services.filter(sv => sv.category === categoryName && (sv.servedCities || []).includes(cityName)).length;
      if (n > 0) comboCounts.set(`${categoryName}|${cityName}`, n);
    }
  }
  const insightsBlock = (text) => (text
    ? `<p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 16px;color:#374151;max-width:760px;margin:0;">${escapeHtml(text)}</p>`
    : '');
  const guideCallout = (guides) => (guides.length
    ? `<p style="margin:16px 0 0;max-width:760px;color:#374151;">What does it cost? Read the full guide: ${guides.map(g => `<a href="${guidePath(g.slug)}" style="${NAV_LINK}">${escapeHtml(g.title)}</a>`).join(' &middot; ')}</p>`
    : '');

  // --- Category pages (23, always indexable) ---
  for (const categoryName of allCategories) {
    const content = getCategoryPageContent(categoryName, null, services);
    const cardsHtml = content.services
      .slice(0, MAX_CARDS_PER_PAGE)
      .map(s => { const { businessHref, serviceHref } = hrefsFor(s); return renderServiceCardHtml(s, businessById.get(s.businessId), businessHref, serviceHref); })
      .join('\n        ');
    const cityLinks = WAKE_COUNTY_CITIES
      .filter(city => comboCounts.has(`${categoryName}|${city}`))
      .map(city => ({ href: categoryCityPath(categoryName, city), label: `${categoryName} in ${city}` }));
    const siblingLinks = (categoryGroupOf.get(categoryName)?.categories || [])
      .filter(c => c !== categoryName)
      .map(c => ({ href: categoryPath(c), label: c }));
    const bodyHtml = listingBody({
      heading: `Cheap ${categoryName} in Wake County, NC`,
      intro: content.description,
      cardsHtml,
      count: content.services.length,
      insightsHtml: insightsBlock(describeInsights(content.insights, categoryName, null)) + guideCallout(content.guides),
      extraHtml: linkRow(`Cheap ${categoryName} by city`, cityLinks) + linkRow('Related services', siblingLinks),
    });
    writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
    sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.8', group: 'core' });
    counts.category++;
  }

  // --- Category x City pages (only combos with >=1 real service) ---
  for (const categoryName of allCategories) {
    for (const cityName of WAKE_COUNTY_CITIES) {
      const content = getCategoryPageContent(categoryName, cityName, services);
      if (content.services.length === 0) continue; // never generate/link an empty combo
      const cardsHtml = content.services
        .slice(0, MAX_CARDS_PER_PAGE)
        .map(s => { const { businessHref, serviceHref } = hrefsFor(s); return renderServiceCardHtml(s, businessById.get(s.businessId), businessHref, serviceHref); })
        .join('\n        ');
      const otherCities = WAKE_COUNTY_CITIES
        .filter(city => city !== cityName && comboCounts.has(`${categoryName}|${city}`))
        .map(city => ({ href: categoryCityPath(categoryName, city), label: `${categoryName} in ${city}` }));
      const otherCategories = allCategories
        .filter(c => c !== categoryName && comboCounts.has(`${c}|${cityName}`))
        .sort((a, b) => comboCounts.get(`${b}|${cityName}`) - comboCounts.get(`${a}|${cityName}`))
        .slice(0, 12)
        .map(c => ({ href: categoryCityPath(c, cityName), label: `${c} in ${cityName}` }));
      const bodyHtml = listingBody({
        heading: `Cheap ${categoryName} in ${cityName}, NC`,
        intro: content.description,
        cardsHtml,
        count: content.services.length,
        insightsHtml: insightsBlock(describeInsights(content.insights, categoryName, cityName)) + guideCallout(content.guides),
        extraHtml:
          linkRow('See the whole county', [{ href: categoryPath(categoryName), label: `All cheap ${categoryName} in Wake County` }]) +
          linkRow(`${categoryName} in nearby cities`, otherCities) +
          linkRow(`More services in ${cityName}`, otherCategories),
      });
      writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
      sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.7', group: 'core' });
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
      .map(s => { const { businessHref, serviceHref } = hrefsFor(s); return renderServiceCardHtml(s, businessById.get(s.businessId), businessHref, serviceHref); })
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
      sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.5', group: 'neighborhoods' });
      counts.neighborhoodIndexed++;
    } else {
      counts.neighborhoodNoindex++;
    }
  }

  // --- Business pages (1,644, all indexable) + their nested service pages ---
  // businessPath()/servicePath() are name-slug only, no id — two businesses
  // with the same name (or, within one business, two identically-titled
  // offerings) would collide and silently overwrite each other's page. The
  // current catalog has zero collisions at either level (verified directly),
  // but warn loudly if a future data change ever introduces one.
  const seenBusinessPaths = new Set();
  const seenServicePaths = new Set();
  for (const business of businesses) {
    const ownServices = services.filter(s => s.businessId === business.id);
    const content = getBusinessPageContent(business, ownServices);
    if (seenBusinessPaths.has(content.path)) {
      console.warn(`WARNING: business URL collision at ${content.path} — "${business.name}" (${business.id}) will overwrite a previous business's page. Businesses need a disambiguated slug.`);
    }
    seenBusinessPaths.add(content.path);
    const cardsHtml = ownServices
      .map(s => renderServiceCardHtml(s, business, content.path, servicePath(business, s)))
      .join('\n        ');
    const badgeHtml = content.honestyBadge
      ? `<div style="display:inline-block;background:#111827;color:#fff;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${escapeHtml(content.honestyBadge)}</div>`
      : '';
    const noteHtml = content.honestyNote
      ? `<p style="color:#6b7280;font-size:14px;max-width:640px;margin:0 0 16px;">${escapeHtml(content.honestyNote)}</p>`
      : '';
    const bizGuides = business.category ? getGuidesForCategory(business.category) : [];
    const bodyHtml = `<section style="max-width:1200px;margin:0 auto;padding:48px 24px;">
      <nav><a href="/" style="color:#059669;text-decoration:none;font-weight:600;">&larr; BetterBuyTheBlock</a>${business.category ? ` &rsaquo; <a href="${escapeHtml(categoryPath(business.category))}" style="color:#059669;text-decoration:none;font-weight:600;">Cheap ${escapeHtml(business.category)} in Wake County</a>` : ''}</nav>
      <h1 style="font-size:32px;font-weight:800;color:#111827;margin:16px 0 8px;">${escapeHtml(business.name)}</h1>
      ${badgeHtml}
      ${noteHtml}
      ${business.description ? `<p style="color:#374151;max-width:640px;margin:0 0 24px;">${escapeHtml(business.description)}</p>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">
        ${cardsHtml || '<p style="color:#9ca3af;">No current deals from this business.</p>'}
      </div>
      ${bizGuides.length ? `<p style="margin-top:32px;color:#374151;">What does ${escapeHtml(business.category.toLowerCase())} cost in Wake County? ${bizGuides.map(g => `<a href="${guidePath(g.slug)}" style="color:#059669;text-decoration:none;font-weight:600;">${escapeHtml(g.title)}</a>`).join(' &middot; ')}</p>` : ''}
    </section>`;
    writeRoute(content.path, pageHtml({ ...content, bodyHtml }));
    sitemapUrls.push({ loc: content.canonicalUrl, priority: '0.6', group: 'businesses' });
    counts.business++;

    // Nested service pages — real business context (name/address/price)
    // carries each page, since the offering title alone repeats across
    // dozens of unrelated businesses (see getServicePageContent).
    for (const service of ownServices) {
      const svcContent = getServicePageContent(business, service);
      if (seenServicePaths.has(svcContent.path)) {
        console.warn(`WARNING: service URL collision at ${svcContent.path} — "${service.title}" (${service.id}) will overwrite a previous service page for this business.`);
      }
      seenServicePaths.add(svcContent.path);
      const discountedPrice = Math.round((service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100));
      const svcBadgeHtml = svcContent.honestyBadge
        ? `<div style="display:inline-block;background:#111827;color:#fff;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${escapeHtml(svcContent.honestyBadge)}</div>`
        : '';
      const svcNoteHtml = svcContent.honestyNote
        ? `<p style="color:#6b7280;font-size:14px;max-width:640px;margin:0 0 16px;">${escapeHtml(svcContent.honestyNote)}</p>`
        : '';
      const svcBodyHtml = `<section style="max-width:800px;margin:0 auto;padding:48px 24px;">
      <nav><a href="/" style="color:#059669;text-decoration:none;font-weight:600;">&larr; BetterBuyTheBlock</a> &rsaquo; <a href="${escapeHtml(content.path)}" style="color:#059669;text-decoration:none;font-weight:600;">${escapeHtml(business.name)}</a></nav>
      <h1 style="font-size:28px;font-weight:800;color:#111827;margin:16px 0 8px;">${escapeHtml(service.title)}</h1>
      <p style="color:#6b7280;margin:0 0 16px;">by <a href="${escapeHtml(content.path)}" style="color:#059669;font-weight:600;text-decoration:none;">${escapeHtml(business.name)}</a></p>
      ${svcBadgeHtml}
      ${svcNoteHtml}
      <p style="color:#374151;max-width:640px;margin:0 0 24px;">${escapeHtml(service.description)}</p>
      <p style="margin:0 0 24px;"><strong style="font-size:32px;color:#15803d;">$${discountedPrice}</strong> <span style="font-size:16px;color:#9ca3af;text-decoration:line-through;">$${(service.standardPrice || 0).toFixed(0)}</span> <span style="font-size:13px;font-weight:700;color:#fff;background:#16a34a;border-radius:9999px;padding:3px 10px;">${service.discountPercentage}% OFF</span></p>
      <p style="color:#6b7280;font-size:14px;">${service.currentSignups || 0} of ${service.requiredSignups} neighbors joined so far. Once enough neighbors join, ${escapeHtml(business.name)} reaches out to schedule at the bulk rate.</p>
    </section>`;
      writeRoute(svcContent.path, pageHtml({ ...svcContent, bodyHtml: svcBodyHtml }));
      if (svcContent.robots.startsWith('index')) sitemapUrls.push({ loc: svcContent.canonicalUrl, priority: '0.5', group: 'businesses' });
      counts.service++;
    }
  }

  // --- Blog: one static page per guide + the /guides hub ---
  // Guides used to exist only as client-rendered JS (sitemap entries with no
  // static HTML behind them), so a crawler that hadn't rendered the SPA yet
  // found nothing. Now each guide is real HTML with Article schema, and the
  // hub gives every guide a crawlable inbound link.
  const guideHref = g => guidePath(g.slug);
  for (const guide of COST_GUIDES) {
    const content = getGuidePageContent(guide, COST_GUIDES, CATEGORY_GROUPS);
    const categoryHref = guide.category ? categoryPath(guide.category) : null;
    // Give each section that links to a category a real href for the static CTA.
    const guideForHtml = {
      ...guide,
      sections: (guide.sections || []).map(sec => ({ ...sec, __href: sec.linkCategory ? categoryPath(sec.linkCategory) : null })),
    };
    const bodyHtml = renderGuideBodyHtml(guideForHtml, { relatedGuides: content.relatedGuides, categoryHref, guideHref });
    writeRoute(content.path, pageHtml({ ...content, bodyHtml, ogImage: guide.image }));
    counts.guide++;
  }
  const hub = getGuidesHubContent(COST_GUIDES);
  const hubBody = renderGuidesHubBodyHtml({
    guides: hub.guides,
    guideHref,
    categoryLinks: allCategories.map(c => ({ href: categoryPath(c), label: `Cheap ${c}` })),
  });
  writeRoute(hub.path, pageHtml({ ...hub, bodyHtml: hubBody }));

  // --- Homepage: give the static shell real, crawlable content + links ---
  // dist/index.html is also the SPA fallback for un-prerendered routes, so
  // this content only ever shows for the instant before React mounts (which
  // replaces #root's contents).
  const latestGuides = [...COST_GUIDES]
    .sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0))
    .slice(0, 6);
  const homeBody = renderHomeBodyHtml({
    groups: CATEGORY_GROUPS.map(g => ({
      name: g.name,
      categories: g.categories.map(c => ({ href: categoryPath(c), label: c })),
    })),
    latestGuides,
    guideHref,
  });
  writeFileSync(
    path.join(DIST, 'index.html'),
    indexHtml.replace('<div id="root"></div>', `<div id="root">${homeBody}</div>`)
  );

  // --- Sitemaps: an index over four focused files ---
  // Splitting by page type is what makes Search Console's per-sitemap
  // indexing counts useful: core (home/guides/categories) vs. businesses vs.
  // neighborhoods can each be watched on their own instead of one 10k-URL blob.
  // lastmod is only emitted where it's true (a guide's own publish date) -
  // a made-up "modified today" on every page trains Google to ignore it.
  const today = new Date().toISOString().slice(0, 10);
  const guideLastmod = new Map(COST_GUIDES.map(g => [`${SITE_URL}${guidePath(g.slug)}`, guideDateIso(g.date)]));
  const coreStatic = [
    { loc: `${SITE_URL}/`, priority: '1.0', group: 'core', lastmod: today },
    { loc: `${SITE_URL}${GUIDES_HUB_PATH}`, priority: '0.9', group: 'core', lastmod: today },
    ...COST_GUIDES.map(g => ({ loc: `${SITE_URL}${guidePath(g.slug)}`, priority: '0.8', group: 'core', lastmod: guideLastmod.get(`${SITE_URL}${guidePath(g.slug)}`) })),
    { loc: `${SITE_URL}/privacy`, priority: '0.2', group: 'core' },
    { loc: `${SITE_URL}/terms`, priority: '0.2', group: 'core' },
  ];
  const allUrls = [...coreStatic, ...sitemapUrls];
  const urlsetXml = (urls) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
  const sitemapFiles = [
    ['sitemap-core.xml', allUrls.filter(u => u.group === 'core')],
    ['sitemap-businesses.xml', allUrls.filter(u => u.group === 'businesses')],
    ['sitemap-neighborhoods.xml', allUrls.filter(u => u.group === 'neighborhoods')],
  ];
  for (const [file, urls] of sitemapFiles) writeFileSync(path.join(DIST, file), urlsetXml(urls));
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapFiles.map(([file]) => `  <sitemap>\n    <loc>${SITE_URL}/${file}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`).join('\n')}
</sitemapindex>
`;
  writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml);

  console.log('SEO prerender summary:');
  console.log(`  Category pages:        ${counts.category}`);
  console.log(`  Category x City pages: ${counts.categoryCity}`);
  console.log(`  Neighborhood pages:    ${counts.neighborhoodIndexed} indexed + ${counts.neighborhoodNoindex} noindex = ${counts.neighborhoodIndexed + counts.neighborhoodNoindex}`);
  console.log(`  Business pages:        ${counts.business}`);
  console.log(`  Service pages:         ${counts.service} (indexable ones only in sitemap)`);
  console.log(`  Guide pages:           ${counts.guide} + hub`);
  console.log(`  Total pages written:   ${counts.category + counts.categoryCity + counts.neighborhoodIndexed + counts.neighborhoodNoindex + counts.business + counts.service}`);
  for (const [file, urls] of sitemapFiles) console.log(`  ${file.padEnd(28)} ${urls.length} URLs`);
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

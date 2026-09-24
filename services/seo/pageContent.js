// Plain JS (no TypeScript) so this runs under plain Node with zero build step —
// this is the single source of truth for SEO page title/description/canonical/
// JSON-LD, shared by scripts/seo/prerender.mjs (build-time static HTML) and
// App.tsx's live meta-sync effect (client hydration). Keeping both sides
// calling into the same functions is what guarantees the crawled page and the
// hydrated page can never drift apart.

import { slugify } from './slugify.js';
import { COST_GUIDES } from './guides.js';

export const SITE_URL = 'https://betterbuytheblock.com';

const BUSINESS_HONESTY_BADGE = 'Not yet a confirmed partner';
const BUSINESS_HONESTY_NOTE =
  "This is a real Wake County business we found in this category - they haven't joined BetterBuyTheBlock yet. The deals below are proposals, not something they've offered. Request one to help bring them here.";
const SERVICE_HONESTY_NOTE =
  "This is a real Wake County business we found in this category - they haven't joined BetterBuyTheBlock yet. This deal is a proposal, not something they've offered. Request it to help bring them here.";

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 1).trimEnd() + '…';
}

// --- URL path builders (also used directly by components for real <a href>s) ---

// No id suffix — just the slugified business name. The current catalog has
// zero name collisions (verified directly against the real data), and a
// clean /business/<name> URL is worth more than defending against a
// hypothetical future duplicate name. If a real collision ever appears, the
// second business's page will simply overwrite the first's at build time —
// scripts/seo/prerender.mjs logs a warning when that happens so it's caught,
// not silent.
export function businessPath(business) {
  return `/business/${slugify(business.name)}`;
}

export function neighborhoodPath(neighborhood) {
  return `/neighborhood/${neighborhood.id}`;
}

export function categoryPath(categoryName) {
  return `/category/${slugify(categoryName)}`;
}

export function categoryCityPath(categoryName, cityName) {
  return `/category/${slugify(categoryName)}/${slugify(cityName)}`;
}

// Nested under the business (not a standalone top-level page) — same
// name-slug-only reasoning as businessPath, but collisions here are scoped
// to one business's own offerings, so the odds of a real collision are far
// lower than a county-wide title match would be.
export function servicePath(business, service) {
  return `${businessPath(business)}/${slugify(service.title)}`;
}

/** Pulls the slug segment(s) out of a "/business/<slug>[/<service-slug>]"
 * pathname. Resolving either back to a real business/service requires the
 * loaded catalog (see App.tsx's pendingBusinessSlug/pendingServiceSlug
 * effect) since no id is in the URL. */
export function parseBusinessSlugFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  // parts[0] is "business"; parts[1] is the business slug.
  return parts[1] || null;
}

export function parseServiceSlugFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length >= 3 ? parts[2] : null;
}

function cityFromAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[1] : null;
}

// --- JSON-LD builders ---

export function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildLocalBusinessJsonLd(business, canonicalUrl) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url: canonicalUrl,
  };
  if (business.address) jsonLd.address = business.address;
  if (business.phone) jsonLd.telephone = business.phone;
  if (business.coverImageUrl) jsonLd.image = business.coverImageUrl;
  if (business.category) jsonLd.additionalType = business.category;
  if (business.website) jsonLd.sameAs = [business.website];
  // Never fabricate a rating for a prospective business with none on file —
  // this only ever passes through real scraped data, per the app's existing
  // honesty framing (see BUSINESS_HONESTY_NOTE / isProspective everywhere else).
  if (business.reviewCount && business.reviewCount > 0 && business.rating) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: business.rating,
      reviewCount: business.reviewCount,
    };
  }
  return jsonLd;
}

export function buildServiceJsonLd(service, business, canonicalUrl) {
  const discountedPrice = Math.round((service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100));
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    description: service.description,
    url: canonicalUrl,
    ...(service.category ? { serviceType: service.category } : {}),
    provider: {
      '@type': 'LocalBusiness',
      name: business.name,
      ...(business.address ? { address: business.address } : {}),
      ...(business.phone ? { telephone: business.phone } : {}),
    },
    areaServed: 'Wake County, NC',
    offers: {
      '@type': 'Offer',
      price: discountedPrice,
      priceCurrency: 'USD',
      url: canonicalUrl,
      availability: 'https://schema.org/InStock',
    },
  };
}

export function buildItemListJsonLd(items, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url: canonicalUrl,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

// --- Per-page-type content builders ---

/**
 * @param {object} business
 * @param {object[]} services - this business's own services (any status)
 */
export function getBusinessPageContent(business, services) {
  const path = businessPath(business);
  const canonicalUrl = `${SITE_URL}${path}`;
  const city = cityFromAddress(business.address);
  const title = `${business.name}${city ? ` - ${city}, NC` : ''} | BetterBuyTheBlock`;
  const description = business.description
    ? truncate(business.description, 155)
    : `${business.name} is a ${business.category || 'home services'} business in Wake County, NC. See current bulk-deal pricing on BetterBuyTheBlock.`;
  const breadcrumb = [
    { name: 'Home', url: SITE_URL },
    ...(business.category ? [{ name: business.category, url: `${SITE_URL}${categoryPath(business.category)}` }] : []),
    { name: business.name, url: canonicalUrl },
  ];
  return {
    path,
    canonicalUrl,
    title,
    description,
    robots: 'index, follow',
    honestyBadge: business.isProspective ? BUSINESS_HONESTY_BADGE : null,
    honestyNote: business.isProspective ? BUSINESS_HONESTY_NOTE : null,
    services,
    jsonLd: [buildLocalBusinessJsonLd(business, canonicalUrl), buildBreadcrumbJsonLd(breadcrumb)],
  };
}

/**
 * A single offering, nested under its business (not a standalone top-level
 * page) — real content (business name/address/price) has to carry the page,
 * since the offering title alone ("Whole-Home Carpet Deep Clean") repeats
 * near-verbatim across dozens of unrelated businesses.
 * @param {object} business
 * @param {object} service
 */
export function getServicePageContent(business, service) {
  const path = servicePath(business, service);
  const canonicalUrl = `${SITE_URL}${path}`;
  const discountedPrice = Math.round((service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100));
  const city = cityFromAddress(business.address);
  const title = `${service.title} by ${business.name}${city ? ` - ${city}, NC` : ''} | BetterBuyTheBlock`;
  const description = `${service.title} from ${business.name}: $${discountedPrice} (${service.discountPercentage}% off the $${service.standardPrice} standard rate) once enough neighbors join. ${truncate(service.description, 100)}`;
  const breadcrumb = [
    { name: 'Home', url: SITE_URL },
    ...(business.category ? [{ name: business.category, url: `${SITE_URL}${categoryPath(business.category)}` }] : []),
    { name: business.name, url: `${SITE_URL}${businessPath(business)}` },
    { name: service.title, url: canonicalUrl },
  ];
  return {
    path,
    canonicalUrl,
    title,
    description,
    // A prospective business's deal is a proposal that near-duplicates its
    // business page (same description, same price) - advertising thousands of
    // those dilutes a young domain's crawl budget and quality signals. Only a
    // real, confirmed business's live deal earns its own indexable page.
    robots: business.isProspective ? 'noindex, follow' : 'index, follow',
    honestyBadge: business.isProspective ? BUSINESS_HONESTY_BADGE : null,
    honestyNote: business.isProspective ? SERVICE_HONESTY_NOTE : null,
    jsonLd: [buildServiceJsonLd(service, business, canonicalUrl), buildBreadcrumbJsonLd(breadcrumb)],
  };
}

/**
 * @param {object} neighborhood
 * @param {object[]} services - services scoped to this neighborhood (via neighborhoodIds or servedCities)
 */
export function getNeighborhoodPageContent(neighborhood, services) {
  const path = neighborhoodPath(neighborhood);
  const canonicalUrl = `${SITE_URL}${path}`;
  const stats = neighborhood.homeStats || null;
  const statsSentence = stats
    ? `${stats.homeCount.toLocaleString()} homes, average assessed value $${stats.avgAssessedValue.toLocaleString()}, average ${stats.avgSqFt.toLocaleString()} sq ft, built around ${stats.avgYearBuilt}.`
    : null;
  const title = `Home Services Deals in ${neighborhood.name}, ${neighborhood.city} NC | BetterBuyTheBlock`;
  const description = stats
    ? `${neighborhood.name} in ${neighborhood.city}, NC: ${statsSentence} Real bulk-pricing home service deals for this neighborhood.`
    : `Bulk-pricing home service deals for ${neighborhood.name}, ${neighborhood.city}, NC.`;
  // No standalone "/city/<slug>" page exists in the URL scheme (only
  // "/category/<slug>/<city-slug>"), so the city itself isn't a real linkable
  // breadcrumb step here — just Home -> this neighborhood.
  const breadcrumb = [
    { name: 'Home', url: SITE_URL },
    { name: `${neighborhood.name}, ${neighborhood.city}`, url: canonicalUrl },
  ];
  return {
    path,
    canonicalUrl,
    title,
    description,
    statsSentence,
    robots: stats ? 'index, follow' : 'noindex, follow',
    services,
    jsonLd: [buildBreadcrumbJsonLd(breadcrumb)],
  };
}

/**
 * County-wide (cityName === null) or city-scoped category page. Filters ONLY
 * off the explicit categoryName/cityName params passed in — deliberately
 * independent of any session/selected-neighborhood state, so this must never
 * reuse the app's session-scoped `filteredServices`/`categoryPageServices`.
 * @param {string} categoryName
 * @param {string | null} cityName
 * @param {object[]} allServices
 */
export function getCategoryPageContent(categoryName, cityName, allServices) {
  const path = cityName ? categoryCityPath(categoryName, cityName) : categoryPath(categoryName);
  const canonicalUrl = `${SITE_URL}${path}`;
  const services = allServices.filter(
    s => s.category === categoryName && (!cityName || (s.servedCities || []).includes(cityName))
  );
  // "Cheap" carries the title (the single highest-value SEO signal on the
  // page); the description varies the phrasing ("discount"/"affordable")
  // rather than repeating "cheap" verbatim, on purpose - real search-term
  // coverage without reading as keyword-stuffed to either Google or a visitor.
  const title = cityName
    ? `Cheap ${categoryName} in ${cityName}, NC - Bulk Discount Pricing | BetterBuyTheBlock`
    : `Cheap ${categoryName} in Wake County, NC - Bulk Discount Pricing | BetterBuyTheBlock`;
  const description = cityName
    ? `Find cheap ${categoryName.toLowerCase()} in ${cityName}, NC. Real, affordable bulk-discount pricing from local businesses - join with your neighbors to unlock the lowest rate.`
    : `Find cheap ${categoryName.toLowerCase()} in Wake County, NC. Real, affordable bulk-discount pricing from local businesses - join with your neighbors to unlock the lowest rate.`;
  const breadcrumb = [
    { name: 'Home', url: SITE_URL },
    { name: categoryName, url: `${SITE_URL}${categoryPath(categoryName)}` },
    ...(cityName ? [{ name: cityName, url: canonicalUrl }] : []),
  ];
  return {
    path,
    canonicalUrl,
    title,
    description,
    robots: 'index, follow',
    services,
    insights: getCategoryInsights(services),
    guides: getGuidesForCategory(categoryName),
    jsonLd: [buildBreadcrumbJsonLd(breadcrumb)],
  };
}

/**
 * Real, per-page numbers computed from the actual services on a category (or
 * category x city) page - the substance that makes each of these pages
 * genuinely different from its siblings instead of one template with the
 * words swapped. Never invented: every figure comes straight from `services`.
 */
export function getCategoryInsights(services) {
  if (!services || services.length === 0) return null;
  const prices = services.map(s => Math.round((s.standardPrice || 0) * (1 - (s.discountPercentage || 0) / 100))).filter(p => p > 0);
  const discounts = services.map(s => s.discountPercentage || 0).filter(d => d > 0);
  return {
    serviceCount: services.length,
    businessCount: new Set(services.map(s => s.businessId)).size,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgDiscount: discounts.length ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length) : null,
  };
}

/** One-sentence plain-English summary of getCategoryInsights, shared by the static page and the live SPA. */
export function describeInsights(insights, categoryName, cityName) {
  if (!insights) return null;
  const where = cityName ? `in ${cityName}` : 'across Wake County';
  const range = insights.minPrice != null && insights.maxPrice != null
    ? ` Bulk-deal prices run from $${insights.minPrice} to $${insights.maxPrice}${insights.avgDiscount ? `, averaging ${insights.avgDiscount}% off the standard rate` : ''}.`
    : '';
  return `${insights.businessCount} local ${categoryName.toLowerCase()} ${insights.businessCount === 1 ? 'business is' : 'businesses are'} listed ${where}, with ${insights.serviceCount} bulk-pricing ${insights.serviceCount === 1 ? 'deal' : 'deals'} to compare.${range}`;
}

// --- Guides (blog) ---

export const GUIDES_HUB_PATH = '/guides';

export function guidePath(slug) {
  return `/guides/${slug}`;
}

/** 'SEP 24, 2026' -> '2026-09-24' (undefined if unparseable). */
export function guideDateIso(dateStr) {
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

/** Guides that cover a category: their primary category, or any section that links to it. */
export function getGuidesForCategory(categoryName, allGuides = COST_GUIDES) {
  return allGuides.filter(g =>
    g.category === categoryName || (g.sections || []).some(sec => sec.linkCategory === categoryName)
  );
}

/**
 * Other guides worth linking from this one: same category group first (a
 * reader on the HVAC guide is likelier to want Plumbing/Electrical than
 * Fencing), then newest. Real internal links, not a decorative widget.
 * @param {object} guide
 * @param {object[]} allGuides
 * @param {{name: string, categories: string[]}[]} categoryGroups
 */
export function getRelatedGuides(guide, allGuides = COST_GUIDES, categoryGroups = [], limit = 4) {
  const groupOf = (cat) => categoryGroups.find(g => g.categories.includes(cat))?.name;
  const myGroup = groupOf(guide.category);
  const time = (g) => new Date(g.date).getTime() || 0;
  return allGuides
    .filter(g => g.slug !== guide.slug)
    .sort((a, b) => {
      const aSame = myGroup && groupOf(a.category) === myGroup ? 0 : 1;
      const bSame = myGroup && groupOf(b.category) === myGroup ? 0 : 1;
      return aSame - bSame || time(b) - time(a);
    })
    .slice(0, limit);
}

export function buildArticleJsonLd(guide, canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    image: guide.image,
    author: { '@type': 'Organization', name: guide.author },
    publisher: {
      '@type': 'Organization',
      name: 'BetterBuyTheBlock',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
    },
    datePublished: guideDateIso(guide.date),
    dateModified: guideDateIso(guide.date),
    mainEntityOfPage: canonicalUrl,
  };
}

export function getGuidePageContent(guide, allGuides = COST_GUIDES, categoryGroups = []) {
  const path = guidePath(guide.slug);
  const canonicalUrl = `${SITE_URL}${path}`;
  const breadcrumb = [
    { name: 'Home', url: SITE_URL },
    { name: 'Cost Guides', url: `${SITE_URL}${GUIDES_HUB_PATH}` },
    { name: guide.title, url: canonicalUrl },
  ];
  return {
    path,
    canonicalUrl,
    title: `${guide.title} | BetterBuyTheBlock`,
    description: guide.description,
    image: guide.image,
    robots: 'index, follow',
    relatedGuides: getRelatedGuides(guide, allGuides, categoryGroups),
    jsonLd: [buildArticleJsonLd(guide, canonicalUrl), buildBreadcrumbJsonLd(breadcrumb)],
  };
}

export function getGuidesHubContent(allGuides = COST_GUIDES) {
  const canonicalUrl = `${SITE_URL}${GUIDES_HUB_PATH}`;
  const guides = [...allGuides].sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
  const breadcrumb = [
    { name: 'Home', url: SITE_URL },
    { name: 'Cost Guides', url: canonicalUrl },
  ];
  return {
    path: GUIDES_HUB_PATH,
    canonicalUrl,
    title: 'Cheap Home Service Cost Guides for Wake County, NC | BetterBuyTheBlock',
    description: `${guides.length} plain-English cost guides for Raleigh and Wake County homeowners: what plumbing, HVAC, roofing, cleaning, landscaping and more really cost, and how to get the cheapest real price by bundling with neighbors.`,
    robots: 'index, follow',
    guides,
    jsonLd: [
      buildItemListJsonLd(guides.map(g => ({ name: g.title, url: `${SITE_URL}${guidePath(g.slug)}` })), canonicalUrl),
      buildBreadcrumbJsonLd(breadcrumb),
    ],
  };
}

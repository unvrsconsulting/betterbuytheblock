// Plain JS (no TypeScript) so this runs under plain Node with zero build step —
// this is the single source of truth for SEO page title/description/canonical/
// JSON-LD, shared by scripts/seo/prerender.mjs (build-time static HTML) and
// App.tsx's live meta-sync effect (client hydration). Keeping both sides
// calling into the same functions is what guarantees the crawled page and the
// hydrated page can never drift apart.

import { slugify } from './slugify.js';

export const SITE_URL = 'https://betterbuytheblock.com';

const BUSINESS_HONESTY_BADGE = 'Not yet a confirmed partner';
const BUSINESS_HONESTY_NOTE =
  "This is a real Wake County business we found in this category - they haven't joined BetterBuyTheBlock yet. The deals below are proposals, not something they've offered. Request one to help bring them here.";

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

/** Pulls the slug segment out of a "/business/<slug>" pathname. Resolving it
 * back to an actual business requires the loaded business list (see
 * App.tsx's pendingBusinessSlug effect) since the id isn't in the URL. */
export function parseBusinessSlugFromPath(pathname) {
  return pathname.split('/').filter(Boolean).pop() || null;
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
  const title = cityName
    ? `${categoryName} in ${cityName}, NC - Bulk Deal Pricing | BetterBuyTheBlock`
    : `${categoryName} in Wake County, NC - Bulk Deal Pricing | BetterBuyTheBlock`;
  const description = cityName
    ? `Compare real ${categoryName.toLowerCase()} pricing and bulk-signup deals from local businesses in ${cityName}, NC.`
    : `Compare real ${categoryName.toLowerCase()} pricing and bulk-signup deals from local businesses across Wake County, NC.`;
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
    jsonLd: [buildBreadcrumbJsonLd(breadcrumb)],
  };
}

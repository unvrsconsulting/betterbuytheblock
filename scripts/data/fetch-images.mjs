#!/usr/bin/env node
// Assigns a real, unique, category-relevant stock photo to every service
// offering in real-businesses.json (via the Pexels API — real photography,
// not generated/fabricated), and sets each business's own cover image to one
// of its own offerings' photos. Idempotent: re-running only fills in
// offerings that don't already have an imageUrl, so it's safe to re-run after
// adding more businesses without re-spending Pexels' rate limit on ones
// already assigned.
//
// Usage: node --env-file=.env.local scripts/data/fetch-images.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, 'real-businesses.json');
const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';
const PER_PAGE = 80; // Pexels' max per request

// One real-world search term per category — the actual query sent to Pexels.
// Every query is anchored on "residential home"/"house" context so results
// are the actual home/yard/interior, not a company van, crew photo, or logo
// — this site only lists residential service deals, never commercial.
// Kept deliberately broad and generic — a narrow query (e.g. "gutter
// cleaning") pulls a small, weird pool: company vans, close-up product
// shots, stray commercial photos. A plain "house exterior"/"home interior"
// query pulls a large pool of real, good-looking residential photography,
// which is what actually belongs on a residential bulk-deal card. Only
// deviates from that base when the category's literal object (a pool, a
// roof, a fence) needs to actually be visible in the shot.
// "single family house" (not just "house") so results are a full standalone
// home — not an apartment building, townhome row, or a tight crop that could
// be any building — matching what a residential bulk-deal card should show.
const EXTERIOR = 'single family house exterior';
const INTERIOR = 'home interior';

const CATEGORY_QUERIES = {
  'Carpet Cleaning': INTERIOR,
  'Cleaning & Maid Services': INTERIOR,
  'Gutter Cleaning': EXTERIOR,
  'House Cleaning': INTERIOR,
  'Power Washing': EXTERIOR,
  'Window Washing': EXTERIOR,
  'Deck or Porch': 'single family house backyard deck',
  'Fencing Service': 'single family house backyard fence',
  'Landscaping': 'single family house front yard',
  'Lawn Service': 'single family house lawn',
  'Pool Maintenance': 'single family house backyard pool',
  'Tree Service': 'single family house yard trees',
  'Electrical': INTERIOR,
  'Handyman Service': INTERIOR,
  'HVAC Maintenance': INTERIOR,
  'Plumbing': INTERIOR,
  'Roofing': 'single family house roof',
  'Solar Panel Installation': 'single family house roof solar panels',
  'Home Security': EXTERIOR,
  'Interior Design': INTERIOR,
  'Moving Services': INTERIOR,
  'Painting': INTERIOR,
  'Pest Control': EXTERIOR,
};

// Some of the above queries are specific enough that Pexels only has ~80
// results total for them, no matter how many pages are requested. When a
// query's pool is genuinely exhausted and more distinct photos are still
// needed, this differently-worded (but still on-topic) query is tried next
// rather than reusing a photo.
const FALLBACK_QUERIES = {
  [EXTERIOR]: 'modern house exterior daytime',
  [INTERIOR]: 'cozy home interior room',
  'single family house backyard deck': 'wood deck patio backyard',
  'single family house backyard fence': 'wood fence backyard yard',
  'single family house front yard': 'garden yard house',
  'single family house lawn': 'green grass lawn yard',
  'single family house backyard pool': 'swimming pool backyard',
  'single family house yard trees': 'trees garden yard',
  'single family house roof': 'roof shingles house',
  'single family house roof solar panels': 'solar panels rooftop',
};

async function searchPexels(query, page) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY not set — run with: node --env-file=.env.local scripts/data/fetch-images.mjs');

  const params = new URLSearchParams({ query, per_page: String(PER_PAGE), page: String(page), orientation: 'landscape' });
  const res = await fetch(`${PEXELS_ENDPOINT}?${params}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.photos || []).map(p => p.src.large);
}

// Fetches enough pages of a query to cover `need` distinct photos (Pexels
// caps a single page at 80), deduping across pages just in case. Returns the
// pool plus the next page number to resume from, so a caller can top it up
// later without refetching pages it already has.
async function fetchPool(query, need, startPage = 1) {
  const seen = new Set();
  const pool = [];
  let page = startPage;
  while (pool.length < need) {
    const batch = await searchPexels(query, page);
    if (batch.length === 0) break; // exhausted Pexels' results for this query
    for (const url of batch) {
      if (!seen.has(url)) {
        seen.add(url);
        pool.push(url);
      }
    }
    if (batch.length < PER_PAGE) { page = null; break; } // Pexels has nothing more for this query
    page++;
  }
  return { pool, nextPage: page };
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  const { businesses, services } = data;

  const servicesNeeding = services.filter(s => !s.imageUrl);

  if (servicesNeeding.length === 0) {
    console.log('Every offering already has an image — nothing to do.');
  } else {
    // Several categories share the same broad query (e.g. every interior
    // category queries "home interior") so they'd draw from the identical
    // Pexels result set — pool by the literal query string, not by category,
    // and size each pool to the real number of services drawing from it, so
    // no two offerings anywhere on the site (even across categories) get
    // assigned the same photo.
    const needByQuery = new Map();
    for (const s of servicesNeeding) {
      const query = CATEGORY_QUERIES[s.category] || s.category;
      needByQuery.set(query, (needByQuery.get(query) || 0) + 1);
    }

    console.log(`Fetching real photo pools for ${needByQuery.size} distinct queries...`);
    const poolsByQuery = new Map();
    const nextPageByQuery = new Map();
    for (const [query, rawNeed] of needByQuery) {
      // Fetch well beyond the raw need — different queries occasionally
      // return overlapping photos (a yard shot can rank for both "front
      // yard" and "lawn"), which eats into a pool's effective distinct
      // count. The buffer gives the global dedup pass real room to route
      // around that instead of falling back to reuse.
      const need = Math.ceil(rawNeed * 1.6);
      process.stdout.write(`  "${query}" (need ${rawNeed}, fetching ${need})... `);
      try {
        const { pool, nextPage } = await fetchPool(query, need);
        poolsByQuery.set(query, pool);
        nextPageByQuery.set(query, nextPage);
        console.log(`${pool.length} photos`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        poolsByQuery.set(query, []);
      }
    }

    // Assign deterministically (by service id) so a re-run without new
    // businesses is stable. One shared index per query string, incrementing
    // across every category drawing from that pool — plus a global used-set,
    // since different query strings occasionally return the same underlying
    // Pexels photo (a yard photo can rank for both "front yard house" and
    // "house exterior"), which per-query pooling alone can't catch.
    const usedGlobally = new Set(services.filter(s => s.imageUrl).map(s => s.imageUrl));
    const usedIndexByQuery = new Map();
    let toppedUp = 0;
    let unavoidableReuse = 0;
    for (const service of servicesNeeding) {
      const query = CATEGORY_QUERIES[service.category] || service.category;
      let pool = poolsByQuery.get(query);
      if (!pool || pool.length === 0) continue;

      let start = usedIndexByQuery.get(query) || 0;
      let chosen = null;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[(start + i) % pool.length];
        if (!usedGlobally.has(candidate)) {
          chosen = candidate;
          usedIndexByQuery.set(query, (start + i + 1) % pool.length);
          break;
        }
      }

      if (chosen == null) {
        // Every photo currently in this pool is already claimed elsewhere on
        // the site — push further into Pexels' results for this exact query
        // (pages this run hasn't looked at yet) rather than reusing.
        let nextPage = nextPageByQuery.get(query);
        while (chosen == null && nextPage != null) {
          try {
            const topUp = await fetchPool(query, PER_PAGE, nextPage);
            nextPageByQuery.set(query, topUp.nextPage);
            nextPage = topUp.nextPage;
            for (const url of topUp.pool) {
              if (!usedGlobally.has(url)) {
                pool = [...pool, url];
                poolsByQuery.set(query, pool);
                chosen = url;
                usedIndexByQuery.set(query, pool.length);
                toppedUp++;
                break;
              }
            }
          } catch {
            break;
          }
        }
      }

      if (chosen == null && FALLBACK_QUERIES[query]) {
        // This query is genuinely tapped out on Pexels — try a differently-
        // worded but still on-topic query instead of reusing a photo.
        const fallbackQuery = FALLBACK_QUERIES[query];
        let fallbackPool = poolsByQuery.get(fallbackQuery);
        let fallbackNextPage = nextPageByQuery.get(fallbackQuery);
        if (fallbackPool === undefined) {
          try {
            const fetched = await fetchPool(fallbackQuery, PER_PAGE);
            fallbackPool = fetched.pool;
            fallbackNextPage = fetched.nextPage;
            poolsByQuery.set(fallbackQuery, fallbackPool);
            nextPageByQuery.set(fallbackQuery, fallbackNextPage);
          } catch {
            fallbackPool = [];
          }
        }
        let fbStart = usedIndexByQuery.get(fallbackQuery) || 0;
        for (let i = 0; i < fallbackPool.length; i++) {
          const candidate = fallbackPool[(fbStart + i) % fallbackPool.length];
          if (!usedGlobally.has(candidate)) {
            chosen = candidate;
            usedIndexByQuery.set(fallbackQuery, (fbStart + i + 1) % fallbackPool.length);
            toppedUp++;
            break;
          }
        }
      }

      if (chosen == null) {
        // Genuinely exhausted Pexels' results for this query — nothing left
        // to fetch. Fall back to the least-reused option available.
        chosen = pool[start % pool.length];
        usedIndexByQuery.set(query, (start + 1) % pool.length);
        unavoidableReuse++;
      }
      usedGlobally.add(chosen);
      service.imageUrl = chosen;
    }
    if (toppedUp > 0) console.log(`Fetched ${toppedUp} extra photos to avoid reuse.`);
    if (unavoidableReuse > 0) {
      console.log(`${unavoidableReuse} offerings had to reuse a photo — Pexels is genuinely out of results for their query.`);
    }
  }

  // Business cover image = one of its own offerings' real images (never a
  // generic/shared placeholder), per the requirement that a business's page
  // background matches something it actually offers.
  let coversSet = 0;
  for (const business of businesses) {
    if (business.coverImageUrl) continue;
    const ownService = services.find(s => s.businessId === business.id && s.imageUrl);
    if (ownService) {
      business.coverImageUrl = ownService.imageUrl;
      coversSet++;
    }
  }

  writeFileSync(DATA_PATH, JSON.stringify({ ...data, businesses, services }, null, 2));
  console.log(`\nAssigned images to ${servicesNeeding.length} offerings and ${coversSet} business covers. Wrote ${path.relative(process.cwd(), DATA_PATH)}.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
// Assigns a real, unique, category-relevant stock photo to every service
// offering in real-businesses.json (via the Pexels API — real photography,
// not generated/fabricated), and sets each business's own cover image to one
// of its own offerings' photos. Idempotent: re-running only fills in
// offerings that don't already have an imageUrl.
//
// All fetching happens upfront, in a bounded number of queries, before
// assignment starts — assignment itself makes zero network calls. An
// earlier version fetched top-up pages per-service on demand, which was
// fine at ~750 services but became extremely slow at ~2,400 (thousands of
// sequential Pexels round trips once the two dominant shared queries,
// "home interior" and "house exterior", ran out of fresh results).
//
// Usage: node --env-file=.env.local scripts/data/fetch-images.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, 'real-businesses.json');
const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';
const PER_PAGE = 80; // Pexels' max per request
const MAX_PAGES_PER_QUERY = 6; // hard cap: at most 480 photos fetched per query string, no matter what

// Every base query is anchored on "residential home"/"house" context so
// results are the actual home/yard/interior, not a company van, crew photo,
// or logo — this site only lists residential service deals, never
// commercial. Each base query lists several differently-worded synonyms;
// all of them get fetched (once, upfront) and merged into one pool, since
// a single broad term like "home interior" only has ~400-500 distinct
// results on Pexels no matter how many pages you request.
const QUERY_GROUPS = {
  INTERIOR: ['home interior', 'cozy home interior room', 'modern home interior design', 'house interior room'],
  EXTERIOR: ['single family house exterior', 'modern house exterior daytime', 'residential house exterior', 'suburban house front'],
  DECK: ['single family house backyard deck', 'wood deck patio backyard', 'backyard deck house'],
  FENCE: ['single family house backyard fence', 'wood fence backyard yard', 'backyard fence house'],
  FRONT_YARD: ['single family house front yard', 'garden yard house', 'front yard landscaping'],
  LAWN: ['single family house lawn', 'green grass lawn yard', 'front yard grass house'],
  POOL: ['single family house backyard pool', 'swimming pool backyard', 'backyard pool house'],
  TREES: ['single family house yard trees', 'trees garden yard', 'yard trees house'],
  ROOF: ['single family house roof', 'roof shingles house', 'house rooftop'],
  SOLAR: ['single family house roof solar panels', 'solar panels rooftop', 'solar panels house roof'],
};

const CATEGORY_QUERY_GROUP = {
  'Carpet Cleaning': 'INTERIOR',
  'Cleaning & Maid Services': 'INTERIOR',
  'Gutter Cleaning': 'EXTERIOR',
  'House Cleaning': 'INTERIOR',
  'Power Washing': 'EXTERIOR',
  'Window Washing': 'EXTERIOR',
  'Deck or Porch': 'DECK',
  'Fencing Service': 'FENCE',
  'Landscaping': 'FRONT_YARD',
  'Lawn Service': 'LAWN',
  'Pool Maintenance': 'POOL',
  'Tree Service': 'TREES',
  'Electrical': 'INTERIOR',
  'Handyman Service': 'INTERIOR',
  'HVAC Maintenance': 'INTERIOR',
  'Plumbing': 'INTERIOR',
  'Roofing': 'ROOF',
  'Solar Panel Installation': 'SOLAR',
  'Home Security': 'EXTERIOR',
  'Interior Design': 'INTERIOR',
  'Moving Services': 'INTERIOR',
  'Painting': 'INTERIOR',
  'Pest Control': 'EXTERIOR',
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

// Fetches up to MAX_PAGES_PER_QUERY pages of a single query string, deduping
// across pages. Bounded no matter what Pexels returns, so this can never
// spin for more than a fixed, small number of requests.
async function fetchQuery(query) {
  const seen = new Set();
  const pool = [];
  for (let page = 1; page <= MAX_PAGES_PER_QUERY; page++) {
    const batch = await searchPexels(query, page);
    if (batch.length === 0) break;
    for (const url of batch) {
      if (!seen.has(url)) {
        seen.add(url);
        pool.push(url);
      }
    }
    if (batch.length < PER_PAGE) break; // Pexels has nothing more for this query
  }
  return pool;
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  const { businesses, services } = data;

  const servicesNeeding = services.filter(s => !s.imageUrl);

  if (servicesNeeding.length === 0) {
    console.log('Every offering already has an image — nothing to do.');
  } else {
    const groupsNeeded = new Set(
      servicesNeeding.map(s => CATEGORY_QUERY_GROUP[s.category] || 'EXTERIOR')
    );

    console.log(`Fetching real photo pools for ${groupsNeeded.size} query groups (${[...groupsNeeded].join(', ')})...`);
    const poolByGroup = new Map();
    for (const group of groupsNeeded) {
      const queries = QUERY_GROUPS[group];
      const merged = [];
      const seen = new Set();
      for (const query of queries) {
        process.stdout.write(`  "${query}"... `);
        try {
          const pool = await fetchQuery(query);
          console.log(`${pool.length} photos`);
          for (const url of pool) {
            if (!seen.has(url)) {
              seen.add(url);
              merged.push(url);
            }
          }
        } catch (err) {
          console.log(`FAILED: ${err.message}`);
        }
      }
      poolByGroup.set(group, merged);
      console.log(`  -> ${group} merged pool: ${merged.length} distinct photos`);
    }

    // Pure offline assignment from here — no more network calls. Deterministic
    // by service id (stable ordering) so a re-run without new data is stable.
    // One shared cursor per group so services in different categories that
    // share a group (e.g. every interior category) still spread across the
    // whole merged pool instead of each starting back at photo zero.
    const usedGlobally = new Set(services.filter(s => s.imageUrl).map(s => s.imageUrl));
    const cursorByGroup = new Map();
    let reused = 0;
    for (const service of servicesNeeding) {
      const group = CATEGORY_QUERY_GROUP[service.category] || 'EXTERIOR';
      const pool = poolByGroup.get(group);
      if (!pool || pool.length === 0) continue;

      const start = cursorByGroup.get(group) || 0;
      let chosen = null;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[(start + i) % pool.length];
        if (!usedGlobally.has(candidate)) {
          chosen = candidate;
          cursorByGroup.set(group, (start + i + 1) % pool.length);
          break;
        }
      }
      if (chosen == null) {
        // Pool fully claimed already - reuse rather than make another live
        // API call, so this stays fast regardless of how many services need
        // photos.
        chosen = pool[start % pool.length];
        cursorByGroup.set(group, (start + 1) % pool.length);
        reused++;
      }
      usedGlobally.add(chosen);
      service.imageUrl = chosen;
    }
    if (reused > 0) {
      console.log(`${reused} offerings had to reuse a photo (their query group's pool ran out of fresh options).`);
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

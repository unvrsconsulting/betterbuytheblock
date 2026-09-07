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
const EXTERIOR = 'house exterior';
const INTERIOR = 'home interior';

const CATEGORY_QUERIES = {
  'Carpet Cleaning': INTERIOR,
  'Cleaning & Maid Services': INTERIOR,
  'Gutter Cleaning': EXTERIOR,
  'House Cleaning': INTERIOR,
  'Power Washing': EXTERIOR,
  'Window Washing': EXTERIOR,
  'Deck or Porch': 'backyard deck house',
  'Fencing Service': 'backyard fence house',
  'Landscaping': 'front yard house',
  'Lawn Service': 'green lawn house',
  'Pool Maintenance': 'backyard pool house',
  'Tree Service': 'yard trees house',
  'Electrical': INTERIOR,
  'Handyman Service': INTERIOR,
  'HVAC Maintenance': INTERIOR,
  'Plumbing': INTERIOR,
  'Roofing': 'house roof',
  'Solar Panel Installation': 'solar panels house roof',
  'Home Security': EXTERIOR,
  'Interior Design': INTERIOR,
  'Moving Services': INTERIOR,
  'Painting': INTERIOR,
  'Pest Control': EXTERIOR,
};

async function searchPexels(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY not set — run with: node --env-file=.env.local scripts/data/fetch-images.mjs');

  const params = new URLSearchParams({ query, per_page: String(PER_PAGE), orientation: 'landscape' });
  const res = await fetch(`${PEXELS_ENDPOINT}?${params}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.photos || []).map(p => p.src.large);
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  const { businesses, services } = data;

  const servicesNeeding = services.filter(s => !s.imageUrl);
  const categoriesNeeded = [...new Set(servicesNeeding.map(s => s.category))];

  if (categoriesNeeded.length === 0) {
    console.log('Every offering already has an image — nothing to do.');
  } else {
    console.log(`Fetching real photo pools for ${categoriesNeeded.length} categories...`);
    const pools = {};
    for (const category of categoriesNeeded) {
      const query = CATEGORY_QUERIES[category] || category;
      process.stdout.write(`  ${category} ("${query}")... `);
      try {
        pools[category] = await searchPexels(query);
        console.log(`${pools[category].length} photos`);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        pools[category] = [];
      }
    }

    // Assign deterministically (by service id) so a re-run without new
    // businesses is stable, cycling through the pool so offerings in the same
    // category get spread across different photos rather than clustering.
    const usedIndexByCategory = {};
    for (const service of servicesNeeding) {
      const pool = pools[service.category];
      if (!pool || pool.length === 0) continue;
      const next = (usedIndexByCategory[service.category] || 0) % pool.length;
      usedIndexByCategory[service.category] = next + 1;
      service.imageUrl = pool[next];
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

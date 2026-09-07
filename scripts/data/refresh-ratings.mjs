#!/usr/bin/env node
// Backfills real Google rating/review count onto businesses ingested before
// rating-capture existed in ingest-real-businesses.mjs (the original 281,
// queried across the original 8 cities). Those businesses' data is otherwise
// real and unchanged — this only fills in the rating fields DataForSEO had
// on file the whole time but the script wasn't yet capturing.
//
// Matches fresh query results back to existing businesses by normalized
// name + category (those businesses predate placeId tracking), and only
// ever fills in a currently-missing rating — never overwrites real data.
//
// Usage: node --env-file=.env.local scripts/data/refresh-ratings.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const NEIGHBORHOODS_PATH = path.join(ROOT, 'public', 'data', 'wake-neighborhoods.json');
const OUT_PATH = path.join(__dirname, 'real-businesses.json');
const ENDPOINT = 'https://api.dataforseo.com/v3/business_data/business_listings/search/live';

const LEGACY_CITIES = ['Raleigh', 'Cary', 'Apex', 'Wake Forest', 'Holly Springs', 'Garner', 'Morrisville', 'Fuquay-Varina'];
const RESULTS_PER_QUERY = 3;

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function cityCentroid(city, neighborhoods) {
  const matches = neighborhoods.filter(n => n.city.toLowerCase() === city.toLowerCase());
  const lat = matches.reduce((sum, n) => sum + n.lat, 0) / matches.length;
  const lng = matches.reduce((sum, n) => sum + n.lng, 0) / matches.length;
  return { lat, lng };
}

async function searchCategory(category, city, lat, lng) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  const cred = Buffer.from(`${login}:${password}`).toString('base64');

  const body = [{
    description: category,
    location_coordinate: `${lat},${lng},12`,
    order_by: ['rating.value,desc'],
    limit: RESULTS_PER_QUERY,
  }];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const task = data.tasks?.[0];
  if (!task || task.status_code !== 20000) throw new Error(task?.status_message || 'unknown task error');
  return { items: task.result?.[0]?.items || [], cost: data.tasks?.[0]?.cost || 0 };
}

async function main() {
  const neighborhoods = JSON.parse(readFileSync(NEIGHBORHOODS_PATH, 'utf-8'));
  const data = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
  const { businesses } = data;

  const missingByKey = new Map();
  for (const b of businesses) {
    if (b.rating) continue;
    missingByKey.set(`${normalize(b.name)}|${b.category}`, b);
  }
  console.log(`${missingByKey.size} businesses missing a rating. Querying original ${LEGACY_CITIES.length} cities to backfill...\n`);

  const categories = [...new Set(businesses.map(b => b.category))];
  let queryCount = 0;
  let errorCount = 0;
  let updatedCount = 0;
  let totalCost = 0;

  for (const category of categories) {
    for (const city of LEGACY_CITIES) {
      queryCount++;
      const { lat, lng } = cityCentroid(city, neighborhoods);
      process.stdout.write(`[${queryCount}/${categories.length * LEGACY_CITIES.length}] ${category} in ${city}... `);
      try {
        const { items, cost } = await searchCategory(category, city, lat, lng);
        totalCost += cost;
        let matched = 0;
        for (const item of items) {
          if (!item.rating?.value) continue;
          const key = `${normalize(item.title)}|${category}`;
          const business = missingByKey.get(key);
          if (business && !business.rating) {
            business.rating = item.rating.value;
            business.reviewCount = item.rating.votes_count || undefined;
            business.placeId = business.placeId || item.place_id;
            missingByKey.delete(key);
            matched++;
            updatedCount++;
          }
        }
        console.log(`${items.length} results, ${matched} matched`);
      } catch (err) {
        errorCount++;
        console.log(`FAILED: ${err.message}`);
      }
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\n${queryCount} queries run (${errorCount} failed), $${totalCost.toFixed(2)} spent.`);
  console.log(`Backfilled ratings on ${updatedCount} businesses. ${missingByKey.size} still have no rating on file at DataForSEO (real — some real businesses just don't have Google reviews yet).`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_PATH)}.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

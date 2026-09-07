#!/usr/bin/env node
// Finds real Wake County businesses via DataForSEO's Business Listings Search
// (backed by their own aggregated Google Business Profile database — never
// LLM-invented). Results are appended to prospects.json, deduped by place_id,
// for later drafting/outreach. Nothing here sends anything.
//
// Usage:
//   node --env-file=.env.local scripts/outreach/prospect.mjs --category "house cleaning" --city Raleigh
//   node --env-file=.env.local scripts/outreach/prospect.mjs --category "lawn care" --city Cary --radius 15 --limit 30
//
// Requires DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD in the environment (.env.local).

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const NEIGHBORHOODS_PATH = path.join(REPO_ROOT, 'public', 'data', 'wake-neighborhoods.json');
const PROSPECTS_PATH = path.join(__dirname, 'prospects.json');

function parseArgs(argv) {
  const out = { radius: 12, limit: 20, claimedOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--category') out.category = argv[++i];
    else if (a === '--city') out.city = argv[++i];
    else if (a === '--radius') out.radius = Number(argv[++i]);
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--claimed-only') out.claimedOnly = true;
  }
  return out;
}

function cityCentroid(city) {
  const neighborhoods = JSON.parse(readFileSync(NEIGHBORHOODS_PATH, 'utf-8'));
  const matches = neighborhoods.filter(n => n.city.toLowerCase() === city.toLowerCase());
  if (matches.length === 0) {
    throw new Error(`No neighborhoods found for city "${city}". Check spelling against public/data/wake-neighborhoods.json.`);
  }
  const lat = matches.reduce((sum, n) => sum + n.lat, 0) / matches.length;
  const lng = matches.reduce((sum, n) => sum + n.lng, 0) / matches.length;
  return { lat, lng, sampleSize: matches.length };
}

function loadProspects() {
  if (!existsSync(PROSPECTS_PATH)) return [];
  return JSON.parse(readFileSync(PROSPECTS_PATH, 'utf-8'));
}

function saveProspects(list) {
  writeFileSync(PROSPECTS_PATH, JSON.stringify(list, null, 2) + '\n');
}

async function searchBusinessListings({ category, lat, lng, radius, limit }) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set — run with: node --env-file=.env.local scripts/outreach/prospect.mjs ...');
  }
  const cred = Buffer.from(`${login}:${password}`).toString('base64');

  const body = [{
    description: category,
    location_coordinate: `${lat},${lng},${radius}`,
    order_by: ['rating.value,desc'],
    limit,
  }];

  const res = await fetch('https://api.dataforseo.com/v3/business_data/business_listings/search/live', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${cred}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`DataForSEO HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error ${data.status_code}: ${data.status_message}`);
  }
  const task = data.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task?.status_message || 'unknown'}`);
  }
  return {
    items: task.result?.[0]?.items || [],
    totalCount: task.result?.[0]?.total_count ?? 0,
    cost: task.cost ?? data.cost ?? 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.category || !args.city) {
    console.error('Usage: node --env-file=.env.local scripts/outreach/prospect.mjs --category "house cleaning" --city Raleigh [--radius 12] [--limit 20] [--claimed-only]');
    process.exit(1);
  }

  const { lat, lng, sampleSize } = cityCentroid(args.city);
  console.log(`Searching "${args.category}" near ${args.city} (centroid from ${sampleSize} known neighborhoods: ${lat.toFixed(4)}, ${lng.toFixed(4)}), radius ${args.radius}km...`);

  const { items, totalCount, cost } = await searchBusinessListings({
    category: args.category,
    lat,
    lng,
    radius: args.radius,
    limit: args.limit,
  });

  console.log(`DataForSEO reports ${totalCount} total matches; fetched ${items.length}. Cost: $${cost.toFixed(4)}`);

  const existing = loadProspects();
  const existingByPlaceId = new Map(existing.map(p => [p.placeId, p]));
  let added = 0;
  let skipped = 0;
  let claimedFiltered = 0;

  for (const item of items) {
    if (args.claimedOnly && !item.is_claimed) {
      claimedFiltered++;
      continue;
    }
    if (existingByPlaceId.has(item.place_id)) {
      skipped++;
      continue;
    }
    const addressInfo = item.address_info || {};
    const fallbackAddress = [addressInfo.address, addressInfo.city, addressInfo.zip]
      .filter(Boolean)
      .join(', ');

    const prospect = {
      placeId: item.place_id,
      name: item.title,
      searchCategory: args.category, // what we searched for
      listedCategory: item.category || null, // their actual Google category
      city: addressInfo.city || args.city,
      address: item.address || fallbackAddress || null,
      phone: item.phone || null,
      rating: item.rating?.value ?? null,
      reviewCount: item.rating?.votes_count ?? null,
      isClaimed: !!item.is_claimed,
      // their own public listing description — real, not written by us; useful
      // for genuine personalization, never to be presented as our own words
      listingDescription: item.description ? item.description.slice(0, 400) : null,
      status: 'new', // new -> drafted -> sent -> replied -> onboarded | declined
      foundDate: new Date().toISOString().slice(0, 10),
      lastContactedDate: null,
      notes: '',
    };
    existing.push(prospect);
    existingByPlaceId.set(item.place_id, prospect);
    added++;
  }

  saveProspects(existing);

  console.log(`Added ${added} new prospects, skipped ${skipped} already on file${args.claimedOnly ? `, filtered ${claimedFiltered} unclaimed` : ''}.`);
  console.log(`Tracker: ${path.relative(REPO_ROOT, PROSPECTS_PATH)} (${existing.length} total prospects, ${existing.filter(p => p.status === 'new').length} awaiting a draft).`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

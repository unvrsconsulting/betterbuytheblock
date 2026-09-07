#!/usr/bin/env node
// One-time cleanup for a real data bug: the original 281-business batch was
// ingested before `placeId` existed on business records, so when the
// city-expansion run later re-discovered those same real companies (many
// serve multiple cities) it couldn't recognize them as already-known and
// added them again under new ids. ~262 of 523 businesses were duplicates of
// another real company already in the file — same name, same real address,
// two separate profile pages, two overlapping/identical deal cards.
//
// Keeps the richer entry per duplicate group (has placeId + multi-offering +
// real rating), merges the other's neighborhood coverage into the survivor's
// services, and drops the stale duplicate's business + service records.
//
// Usage: node scripts/data/dedupe-businesses.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, 'real-businesses.json');

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function main() {
  const data = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
  const { businesses, services } = data;

  const groups = new Map();
  for (const b of businesses) {
    const key = normalize(b.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }

  const toDrop = new Set();
  let mergedGroups = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    mergedGroups++;

    // Prefer: has placeId > has rating > more services > lower bizIdx (older/stabler id)
    const score = (b) => {
      const svcCount = services.filter(s => s.businessId === b.id).length;
      return (b.placeId ? 1000 : 0) + (b.rating ? 100 : 0) + svcCount;
    };
    const sorted = [...group].sort((a, b) => score(b) - score(a));
    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Merge losers' service-area coverage into the winner's own services so we
    // don't lose neighborhoods that were only found via the loser's city search.
    const loserNeighborhoodIds = new Set();
    for (const loser of losers) {
      for (const s of services.filter(s => s.businessId === loser.id)) {
        for (const nId of s.neighborhoodIds || []) loserNeighborhoodIds.add(nId);
      }
      toDrop.add(loser.id);
    }
    for (const s of services.filter(s => s.businessId === winner.id)) {
      s.neighborhoodIds = [...new Set([...(s.neighborhoodIds || []), ...loserNeighborhoodIds])];
    }
  }

  const keptBusinesses = businesses.filter(b => !toDrop.has(b.id));
  const keptServices = services.filter(s => !toDrop.has(s.businessId));

  writeFileSync(OUT_PATH, JSON.stringify({ businesses: keptBusinesses, services: keptServices }, null, 2));
  console.log(`${mergedGroups} duplicate name-groups found. Dropped ${toDrop.size} stale duplicate businesses.`);
  console.log(`Businesses: ${businesses.length} -> ${keptBusinesses.length}. Services: ${services.length} -> ${keptServices.length}.`);
}

main();

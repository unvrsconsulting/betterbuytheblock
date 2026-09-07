#!/usr/bin/env node
// Adds a compact `servedCities` field to every service, derived from the
// cities of its existing (small, top-8-per-city) neighborhoodIds. This is
// what actually gates whether a service shows up for a selected
// neighborhood - real home service businesses serve their whole city, not
// just its 8 largest subdivisions, but storing every neighborhood ID per
// service (~4,990 of them) would bloat the fetched JSON to 25MB+. Matching
// by city instead keeps the payload small while still covering every real
// neighborhood: see the (s.servedCities || []).includes(city) checks added
// alongside the existing neighborhoodIds checks across the app.
//
// Usage: node scripts/data/add-served-cities.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const NEIGHBORHOODS_PATH = path.join(ROOT, 'public', 'data', 'wake-neighborhoods.json');
const OUT_PATH = path.join(__dirname, 'real-businesses.json');

function main() {
  const neighborhoods = JSON.parse(readFileSync(NEIGHBORHOODS_PATH, 'utf-8'));
  const cityById = new Map(neighborhoods.map(n => [n.id, n.city]));

  const data = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
  const { services } = data;

  let tagged = 0;
  for (const service of services) {
    const cities = new Set(
      (service.neighborhoodIds || [])
        .map(id => cityById.get(id))
        .filter(Boolean)
    );
    if (cities.size === 0) continue;
    service.servedCities = [...cities];
    tagged++;
  }

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));
  console.log(`Tagged ${tagged} of ${services.length} services with servedCities.`);
}

main();

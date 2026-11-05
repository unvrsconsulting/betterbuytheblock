#!/usr/bin/env node
// Drops listings that aren't the home service their category claims: apartment complexes filed under
// Pool Maintenance, insurance agents and storage lots under Home Security, a church and a physical therapy
// clinic under Moving Services, a food donation box under House Cleaning, and so on. Showing proposed deals
// for these misleads visitors and hurts the site's quality signals in search.
//
// The removed Google place IDs are recorded in excluded-businesses.json, which ingest-real-businesses.mjs
// reads so a future ingest run doesn't add them back.
//
// Usage: node scripts/data/remove-miscategorized.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_PATH = path.join(__dirname, 'real-businesses.json');
const EXCLUDED_PATH = path.join(__dirname, 'excluded-businesses.json');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'data');

// id -> why it isn't the listed service (reviewed by hand against each listing's own description).
const REMOVE = {
  'real-biz-138': 'apartment complex, not pool maintenance',
  'real-biz-227': 'real estate agent, not home security',
  'real-biz-264': 'real estate agent, not painting',
  'real-biz-359': 'real estate agent, not landscaping',
  'real-biz-379': 'apartment complex, not pool maintenance',
  'real-biz-405': 'chiropractor, not electrical',
  'real-biz-459': 'salon suites, not home security',
  'real-biz-466': 'self storage, not home security',
  'real-biz-467': 'insurance agency, not home security',
  'real-biz-470': 'RV and boat storage, not home security',
  'real-biz-490': 'church, not moving services',
  'real-biz-493': 'insurance agency, not moving services',
  'real-biz-495': 'physical therapy clinic, not moving services',
  'real-biz-624': 'community food donation box, not house cleaning',
  'real-biz-783': 'apartment complex, not pool maintenance',
  'real-biz-784': 'apartment complex, not pool maintenance',
  'real-biz-1028': 'in-home childcare, not home security',
  'real-biz-1029': 'insurance agency, not home security',
  'real-biz-1053': 'outdoor vehicle storage, not home security',
  'real-biz-1054': 'insurance agency, not home security',
  'real-biz-1080': 'photographer, not interior design',
  'real-biz-1102': 'real estate firm, not interior design',
  'real-biz-1113': 'self storage, not moving services',
  'real-biz-1658': 'insurance agency, not home security',
  'real-biz-1660': 'insurance agent, not home security',
  'real-biz-1662': 'law firm, not home security',
  'real-biz-1665': 'in-home childcare, not home security',
  'real-biz-1679': 'real estate photography, not interior design',
  'real-biz-1735': 'self storage, not moving services',
  'real-biz-1745': 'massage therapy, not moving services',
  'real-biz-1800': 'auto body shop, not house painting',
  'real-biz-1838': 'self storage, not pest control',
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const ids = new Set(Object.keys(REMOVE));

const real = readJson(REAL_PATH);
const removed = real.businesses.filter(b => ids.has(b.id));
const missing = [...ids].filter(id => !removed.some(b => b.id === id));
if (missing.length) {
  console.error(`Not found in real-businesses.json (already removed?): ${missing.join(', ')}`);
}

let excluded = [];
try { excluded = readJson(EXCLUDED_PATH); } catch { /* first run */ }
const known = new Set(excluded.map(e => e.placeId).filter(Boolean));
for (const b of removed) {
  if (b.placeId && !known.has(b.placeId)) excluded.push({ placeId: b.placeId, name: b.name, reason: REMOVE[b.id] });
}

const keep = (list) => list.filter(x => !ids.has(x.id));
const keepServices = (list) => list.filter(s => !ids.has(s.businessId));

const before = { businesses: real.businesses.length, services: real.services.length };
real.businesses = keep(real.businesses);
real.services = keepServices(real.services);
writeFileSync(REAL_PATH, JSON.stringify(real, null, 2));
writeFileSync(EXCLUDED_PATH, JSON.stringify(excluded, null, 2) + '\n');

const seedBiz = path.join(PUBLIC_DIR, 'seed-businesses.json');
const seedSvc = path.join(PUBLIC_DIR, 'seed-services.json');
writeFileSync(seedBiz, JSON.stringify(keep(readJson(seedBiz)), null, 2));
writeFileSync(seedSvc, JSON.stringify(keepServices(readJson(seedSvc)), null, 2));

console.log(`Removed ${before.businesses - real.businesses.length} businesses and ${before.services - real.services.length} deals.`);
console.log(`${excluded.length} place IDs now in excluded-businesses.json.`);

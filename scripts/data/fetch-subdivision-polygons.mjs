#!/usr/bin/env node
// Phase 1 of the real per-neighborhood housing-stats pipeline.
//
// Wake County's own Planning/Subdivisions layer (the same source
// public/data/wake-neighborhoods.json was built from) has real polygon
// boundaries per subdivision. This fetches them and matches each polygon to
// our existing neighborhood records by normalized name+city, so the next
// phase can spatially join real parcels against real subdivision boundaries
// instead of guessing from a centroid + radius.
//
// Output is an intermediate build artifact (not shipped): geometry is large
// and only needed to drive phase 2's spatial queries.
//
// Usage: node scripts/data/fetch-subdivision-polygons.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEIGHBORHOODS_PATH = path.join(__dirname, '..', '..', 'public', 'data', 'wake-neighborhoods.json');
const OUT_PATH = path.join(__dirname, '.subdivision-polygons.json');
const ENDPOINT = 'https://maps.wake.gov/arcgis/rest/services/Planning/Subdivisions/MapServer/0/query';
const PAGE_SIZE = 2000;

const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: "STATUS='EXISTING'",
    outFields: 'NAME,JURISDICTION,LOTS',
    returnGeometry: 'true',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: 'json',
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} at offset ${offset}`);
  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error at offset ${offset}: ${data.error.message}`);
  return data;
}

async function main() {
  const neighborhoods = JSON.parse(readFileSync(NEIGHBORHOODS_PATH, 'utf-8'));
  const byKey = new Map();
  for (const n of neighborhoods) {
    byKey.set(`${normalize(n.name)}|${normalize(n.city)}`, n.id);
  }
  console.log(`Loaded ${neighborhoods.length} known neighborhoods to match against.`);

  let offset = 0;
  let spatialReference = null;
  const matched = []; // { id, rings }
  let totalFetched = 0;
  let unmatchedCount = 0;

  while (true) {
    console.log(`Fetching subdivisions offset ${offset}...`);
    const page = await fetchPage(offset);
    const features = page.features || [];
    if (features.length === 0) break;
    spatialReference = spatialReference || page.spatialReference;
    totalFetched += features.length;

    for (const f of features) {
      const key = `${normalize(f.attributes.NAME)}|${normalize(f.attributes.JURISDICTION)}`;
      const id = byKey.get(key);
      if (id && f.geometry?.rings) {
        matched.push({ id, rings: f.geometry.rings });
      } else {
        unmatchedCount++;
      }
    }

    if (!page.exceededTransferLimit && features.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Fetched ${totalFetched} subdivision polygons; matched ${matched.length} to known neighborhoods, ${unmatchedCount} unmatched (renamed/merged/new since our dataset was built).`);

  writeFileSync(OUT_PATH, JSON.stringify({ spatialReference, matched }));
  console.log(`Wrote ${path.relative(process.cwd(), OUT_PATH)} (${matched.length} polygons, intermediate — not shipped to the app).`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
// Phase 2: for each subdivision polygon from phase 1, spatially query Wake
// County's real parcel database for single-family homes actually within that
// boundary and aggregate real stats (count, avg assessed value, avg sq ft,
// avg year built) — a genuine per-neighborhood figure, not an estimate.
//
// Long-running (thousands of polygons) — concurrency-limited and checkpoints
// progress to the output file every CHECKPOINT_EVERY polygons, so it's safe
// to re-run after an interruption (already-processed ids are skipped).
//
// Usage: node scripts/data/fetch-neighborhood-stats.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLYGONS_PATH = path.join(__dirname, '.subdivision-polygons.json');
const OUT_PATH = path.join(__dirname, '..', '..', 'public', 'data', 'wake-neighborhood-stats.json');
const ENDPOINT = 'https://maps.wake.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0/query';
const CONCURRENCY = 8;
const CHECKPOINT_EVERY = 100;
const MAX_RETRIES = 3;

async function queryOne({ id, rings }, spatialReference) {
  const geometry = JSON.stringify({ rings, spatialReference });
  const outStatistics = JSON.stringify([
    { statisticType: 'count', onStatisticField: 'PIN_NUM', outStatisticFieldName: 'homeCount' },
    { statisticType: 'avg', onStatisticField: 'TOTAL_VALUE_ASSD', outStatisticFieldName: 'avgAssessedValue' },
    { statisticType: 'avg', onStatisticField: 'HEATEDAREA', outStatisticFieldName: 'avgSqFt' },
    { statisticType: 'avg', onStatisticField: 'YEAR_BUILT', outStatisticFieldName: 'avgYearBuilt' },
  ]);

  const body = new URLSearchParams({
    where: "TYPE_USE_DECODE='SINGLFAM'",
    geometry,
    geometryType: 'esriGeometryPolygon',
    spatialRel: 'esriSpatialRelIntersects',
    outStatistics,
    f: 'json',
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const attrs = data.features?.[0]?.attributes || {};
      const homeCount = Math.round(attrs.HOMECOUNT ?? attrs.homeCount ?? 0);
      if (homeCount === 0) return null; // no real single-family parcels found in this boundary
      return {
        id,
        stats: {
          homeCount,
          avgAssessedValue: Math.round(attrs.AVGASSESSEDVALUE ?? attrs.avgAssessedValue ?? 0),
          avgSqFt: Math.round(attrs.AVGSQFT ?? attrs.avgSqFt ?? 0),
          avgYearBuilt: Math.round(attrs.AVGYEARBUILT ?? attrs.avgYearBuilt ?? 0),
        },
      };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`  Failed ${id} after ${MAX_RETRIES} attempts: ${err.message}`);
        return null;
      }
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

async function runPool(items, concurrency, worker, onProgress) {
  const results = [];
  let idx = 0;
  let done = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      const result = await worker(items[i]);
      results[i] = result;
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  if (!existsSync(POLYGONS_PATH)) {
    console.error('Run fetch-subdivision-polygons.mjs first.');
    process.exit(1);
  }
  const { spatialReference, matched } = JSON.parse(readFileSync(POLYGONS_PATH, 'utf-8'));

  let existingResults = {};
  let alreadyDone = new Set();
  if (existsSync(OUT_PATH)) {
    const prior = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    existingResults = prior.neighborhoods || {};
    alreadyDone = new Set(Object.keys(existingResults));
    console.log(`Resuming: ${alreadyDone.size} neighborhoods already have real stats from a prior run.`);
  }

  const remaining = matched.filter(m => !alreadyDone.has(m.id));
  console.log(`Querying real parcel data for ${remaining.length} neighborhoods (${CONCURRENCY} at a time)...`);

  const results = { ...existingResults };
  let sinceCheckpoint = 0;

  const save = () => {
    writeFileSync(OUT_PATH, JSON.stringify({
      source: 'Wake County GIS — Property/Parcels spatially joined to Planning/Subdivisions boundaries, single-family homes only',
      fetchedAt: new Date().toISOString(),
      neighborhoods: results,
    }, null, 2));
  };

  await runPool(remaining, CONCURRENCY, async (item) => {
    const result = await queryOne(item, spatialReference);
    if (result) results[result.id] = result.stats;
    sinceCheckpoint++;
    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      sinceCheckpoint = 0;
      save();
    }
    return result;
  }, (done, total) => {
    if (done % 100 === 0 || done === total) {
      console.log(`  ${done}/${total} (${Math.round((done / total) * 100)}%)`);
    }
  });

  save();
  console.log(`\nDone. ${Object.keys(results).length} neighborhoods with real stats written to ${path.relative(process.cwd(), OUT_PATH)}.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

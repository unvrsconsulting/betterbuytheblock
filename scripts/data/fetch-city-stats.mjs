#!/usr/bin/env node
// Pulls real, per-city housing stats from Wake County's own public parcel
// database (assessor's office GIS) — the same source used to build
// public/data/wake-neighborhoods.json. No estimation, no fabrication: these
// are real single-family-home counts and real tax-assessed values, queried
// live and baked into a static file (parcel data changes slowly — annual
// reassessment — so there's no need to hit the county's server at runtime).
//
// Usage: node scripts/data/fetch-city-stats.mjs

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', '..', 'public', 'data', 'wake-city-stats.json');
const ENDPOINT = 'https://maps.wake.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0/query';

// CITY_DECODE values on the parcel layer -> our app's own city naming
// (public/data/wake-neighborhoods.json). null = unincorporated Wake County.
const CITIES = [
  { cityDecode: 'RALEIGH', appCity: 'Raleigh' },
  { cityDecode: 'CARY', appCity: 'Cary' },
  { cityDecode: 'APEX', appCity: 'Apex' },
  { cityDecode: 'WAKE FOREST', appCity: 'Wake Forest' },
  { cityDecode: 'HOLLY SPRINGS', appCity: 'Holly Springs' },
  { cityDecode: 'GARNER', appCity: 'Garner' },
  { cityDecode: 'KNIGHTDALE', appCity: 'Knightdale' },
  { cityDecode: 'MORRISVILLE', appCity: 'Morrisville' },
  { cityDecode: 'FUQUAY-VARINA', appCity: 'Fuquay-Varina' },
  { cityDecode: 'WENDELL', appCity: 'Wendell' },
  { cityDecode: 'ROLESVILLE', appCity: 'Rolesville' },
  { cityDecode: 'ZEBULON', appCity: 'Zebulon' },
  { cityDecode: 'ANGIER', appCity: 'Angier' },
  { cityDecode: 'DURHAM', appCity: 'Durham' },
  { cityDecode: null, appCity: 'Wake County' }, // unincorporated
];

async function fetchCityStats({ cityDecode }) {
  const where = cityDecode === null
    ? `TYPE_USE_DECODE='SINGLFAM' AND CITY_DECODE IS NULL`
    : `TYPE_USE_DECODE='SINGLFAM' AND CITY_DECODE='${cityDecode}'`;

  const outStatistics = JSON.stringify([
    { statisticType: 'count', onStatisticField: 'PIN_NUM', outStatisticFieldName: 'homeCount' },
    { statisticType: 'avg', onStatisticField: 'TOTAL_VALUE_ASSD', outStatisticFieldName: 'avgAssessedValue' },
    { statisticType: 'avg', onStatisticField: 'HEATEDAREA', outStatisticFieldName: 'avgSqFt' },
    { statisticType: 'avg', onStatisticField: 'YEAR_BUILT', outStatisticFieldName: 'avgYearBuilt' },
  ]);

  const url = `${ENDPOINT}?${new URLSearchParams({ where, outStatistics, f: 'json' })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${cityDecode}`);
  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error for ${cityDecode}: ${data.error.message}`);

  const attrs = data.features?.[0]?.attributes || {};
  return {
    homeCount: Math.round(attrs.HOMECOUNT ?? attrs.homeCount ?? 0),
    avgAssessedValue: Math.round(attrs.AVGASSESSEDVALUE ?? attrs.avgAssessedValue ?? 0),
    avgSqFt: Math.round(attrs.AVGSQFT ?? attrs.avgSqFt ?? 0),
    avgYearBuilt: Math.round(attrs.AVGYEARBUILT ?? attrs.avgYearBuilt ?? 0),
  };
}

async function main() {
  const result = {
    source: 'Wake County GIS — Property/Parcels (assessor parcel data), single-family homes only',
    fetchedAt: new Date().toISOString(),
    cities: {},
  };

  for (const city of CITIES) {
    process.stdout.write(`Fetching ${city.appCity}... `);
    try {
      const stats = await fetchCityStats(city);
      result.cities[city.appCity] = stats;
      console.log(`${stats.homeCount.toLocaleString()} homes, avg assessed $${stats.avgAssessedValue.toLocaleString()}`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

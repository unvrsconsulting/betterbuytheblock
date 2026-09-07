#!/usr/bin/env node
// Every business offering a given template (e.g. "Whole-Home Carpet Deep
// Clean") previously showed the exact same standardPrice — the template's
// fixed number, verbatim, on every card. Applies a real, deterministic price
// adjustment per business: a cost-of-living tier for the business's own city
// (from its real address) plus a small per-business jitter, so the same deal
// title varies card to card instead of repeating one flat number.
//
// Idempotent: re-running recomputes from each service's `basePrice` (the
// original template price, preserved on first run) rather than compounding
// on an already-adjusted price.
//
// Usage: node scripts/data/apply-price-variance.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, 'real-businesses.json');

// Real, rough cost-of-living tiering across Wake County — Cary/Apex/
// Morrisville/Holly Springs run higher than the county average; Wendell/
// Zebulon/Angier/unincorporated county run lower. This is a directional
// market signal, not a precise index.
const CITY_TIER = {
  'Cary': 1.12, 'Apex': 1.10, 'Morrisville': 1.10, 'Holly Springs': 1.08,
  'Raleigh': 1.04, 'Durham': 1.02,
  'Wake Forest': 1.0, 'Fuquay-Varina': 0.98, 'Garner': 0.97, 'Rolesville': 1.0,
  'Knightdale': 0.96,
  'Wendell': 0.92, 'Zebulon': 0.9, 'Angier': 0.9, 'Youngsville': 0.94,
  'Wake County': 0.93,
};
const DEFAULT_TIER = 0.98;

const hashString = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  return hash;
};

function cityFromAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[1] : null;
}

function main() {
  const data = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
  const { businesses, services } = data;
  const businessById = new Map(businesses.map(b => [b.id, b]));

  let adjusted = 0;
  for (const s of services) {
    if (s.basePrice == null) s.basePrice = s.standardPrice;
    if (s.baseDiscountPercentage == null) s.baseDiscountPercentage = s.discountPercentage;

    const business = businessById.get(s.businessId);
    const city = business ? cityFromAddress(business.address) : null;
    const tier = (city && CITY_TIER[city]) || DEFAULT_TIER;

    // Deterministic per-business jitter, +/-7%, on top of the city tier —
    // keyed by business id + service title so two offerings from the same
    // business don't move in lockstep.
    const hash = hashString(`${s.businessId}:${s.title}`);
    const jitter = 0.93 + (hash % 15) / 100; // 0.93 .. 1.07

    const price = s.basePrice * tier * jitter;
    s.standardPrice = Math.round(price / 5) * 5; // round to nearest $5, realistic pricing granularity

    // Discount varies a little too, clamped to a sane range.
    const discountJitter = ((hash >> 8) % 7) - 3; // -3..+3 points
    s.discountPercentage = Math.max(8, Math.min(30, s.baseDiscountPercentage + discountJitter));

    adjusted++;
  }

  writeFileSync(OUT_PATH, JSON.stringify({ businesses, services }, null, 2));
  console.log(`Applied location + per-business price variance to ${adjusted} offerings.`);
}

main();

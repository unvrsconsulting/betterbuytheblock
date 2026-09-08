#!/usr/bin/env node
// Populates the site with real Wake County businesses (name/category/address/
// phone all real, via DataForSEO's Business Listings Search) paired with a
// PROPOSED deal per business — never a fabricated identity, and never implied
// as something the business actually agreed to. Both are marked
// `isProspective: true` and the app enforces the honest framing everywhere
// they're rendered (see Business.isProspective / Service.isProspective in
// types.ts): no fake rating/review/license, "Not yet a confirmed partner"
// badge, "Join" replaced with "Request This Deal".
//
// Service areas ("cities/neighborhoods they list they can serve") are derived
// from each business's own public listing description — real self-reported
// text, not invented — matched against our known Wake County city names.
//
// Usage: node --env-file=.env.local scripts/data/ingest-real-businesses.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const NEIGHBORHOODS_PATH = path.join(ROOT, 'public', 'data', 'wake-neighborhoods.json');
const NEIGHBORHOOD_STATS_PATH = path.join(ROOT, 'public', 'data', 'wake-neighborhood-stats.json');
const OUT_PATH = path.join(__dirname, 'real-businesses.json');
const ENDPOINT = 'https://api.dataforseo.com/v3/business_data/business_listings/search/live';

// All of Wake County's real incorporated municipalities plus its unincorporated
// area (excludes Durham, a border city in the neighborhoods dataset that's
// mostly a different county). Started at 8 cities; expanded to the full 14 to
// find more real businesses once every category had already been queried.
const CITIES = ['Raleigh', 'Cary', 'Apex', 'Wake Forest', 'Holly Springs', 'Garner', 'Morrisville', 'Fuquay-Varina', 'Knightdale', 'Wendell', 'Zebulon', 'Rolesville', 'Angier', 'Wake County'];
// DEEPEN=1 re-queries every category/city pair again with a higher result
// limit, to find more real businesses per combo (DataForSEO's per-query cost
// is roughly fixed regardless of `limit`, so this is the cost-efficient way
// to grow coverage rather than more queries at limit=3). New finds are still
// deduped against existing businesses by place_id.
const DEEPEN = process.env.DEEPEN === '1';
const RESULTS_PER_QUERY = DEEPEN ? 20 : 3;
const NEIGHBORHOODS_PER_SERVED_CITY = 8;

// Multiple proposed-deal variants per category — realistic pricing/discount/
// signup patterns consistent with the example deals already shown pre-launch.
// A business gets a subset of its category's variants (deterministic by id),
// not per-business fabrication, and never all of them at once.
// Base prices researched Sep 2026 against Angi/HomeGuide/HouseCallPro/Fixr/
// LawnStarter/EnergySage and Raleigh-area trade pricing pages — see the
// commit that introduced this pass for source notes per line item. This is
// the one-time, non-bulk market rate; the app's own bulk-signup discount
// (discountPercentage) is layered on top of it, not itself a researched
// external figure.
const DEAL_TEMPLATES = {
  'Carpet Cleaning': [
    { title: 'Whole-Home Carpet Deep Clean', description: 'Hot water extraction cleaning for every carpeted room, lifting embedded dirt and allergens.', standardPrice: 225, discountPercentage: 15, requiredSignups: 6 },
    { title: 'Stain & Odor Treatment', description: 'Targeted pretreatment for pet stains, spills, and high-traffic wear paths.', standardPrice: 95, discountPercentage: 14, requiredSignups: 5 },
    { title: 'Area Rug Cleaning', description: 'Professional off-site cleaning for wool, synthetic, and specialty area rugs.', standardPrice: 135, discountPercentage: 18, requiredSignups: 4 },
  ],
  'Cleaning & Maid Services': [
    { title: 'Recurring Bi-Weekly Cleaning', description: 'A standing bi-weekly visit to keep kitchens, bathrooms, and living areas consistently clean.', standardPrice: 185, discountPercentage: 19, requiredSignups: 12 },
    { title: 'One-Time Deep Clean', description: 'Top-to-bottom detail clean covering baseboards, appliances, and forgotten corners.', standardPrice: 265, discountPercentage: 21, requiredSignups: 8 },
    { title: 'Move-In / Move-Out Cleaning', description: 'A thorough clean so a new home is spotless before the boxes arrive.', standardPrice: 325, discountPercentage: 16, requiredSignups: 6 },
  ],
  'Gutter Cleaning': [
    { title: 'Full Gutter Cleaning & Flush', description: 'Clear debris and flush downspouts so storms drain properly.', standardPrice: 135, discountPercentage: 20, requiredSignups: 6 },
    { title: 'Gutter Guard Installation', description: 'Mesh guards installed to cut down on future clogging from leaves and pine needles.', standardPrice: 1500, discountPercentage: 16, requiredSignups: 6 },
    { title: 'Downspout Repair & Realignment', description: 'Fix disconnected or misaligned downspouts causing water pooling near your foundation.', standardPrice: 150, discountPercentage: 14, requiredSignups: 4 },
  ],
  'House Cleaning': [
    { title: 'Bi-Weekly House Cleaning', description: 'A standing bi-weekly visit to keep kitchens, bathrooms, and living areas consistently clean.', standardPrice: 185, discountPercentage: 18, requiredSignups: 10 },
    { title: 'One-Time Deep House Cleaning', description: 'A one-time, top-to-bottom deep clean of your entire home.', standardPrice: 265, discountPercentage: 20, requiredSignups: 5 },
    { title: 'Standard Weekly Cleaning', description: 'Consistent weekly upkeep covering kitchens, bathrooms, and common areas.', standardPrice: 190, discountPercentage: 10, requiredSignups: 9 },
  ],
  'Power Washing': [
    { title: 'House Exterior Power Wash', description: "Full siding wash to remove pollen, mildew, and grime from your home's exterior.", standardPrice: 275, discountPercentage: 20, requiredSignups: 10 },
    { title: 'Driveway & Walkway Cleaning', description: 'High-pressure cleaning to lift oil stains and built-up dirt from concrete.', standardPrice: 195, discountPercentage: 15, requiredSignups: 6 },
    { title: 'Deck & Patio Power Wash', description: 'Deep clean for decks and patios ahead of staining or summer entertaining.', standardPrice: 225, discountPercentage: 14, requiredSignups: 4 },
  ],
  'Window Washing': [
    { title: 'Interior & Exterior Window Cleaning', description: 'A full streak-free clean for every window, inside and out.', standardPrice: 225, discountPercentage: 18, requiredSignups: 4 },
    { title: 'Screen Cleaning & Repair', description: 'Screen cleaning with repair or replacement for torn screens.', standardPrice: 165, discountPercentage: 12, requiredSignups: 4 },
    { title: 'Gutter & Window Combo Clean', description: 'Bundled gutter clearing and window washing in one visit.', standardPrice: 295, discountPercentage: 17, requiredSignups: 4 },
  ],
  'Deck or Porch': [
    { title: 'Deck Staining & Sealing', description: 'Pressure wash, sand, and reseal your deck to protect it through another Carolina summer.', standardPrice: 650, discountPercentage: 15, requiredSignups: 5 },
    { title: 'Porch Refresh & Repair', description: 'Board replacement, railing tightening, and a fresh coat of paint or stain.', standardPrice: 450, discountPercentage: 12, requiredSignups: 4 },
    { title: 'Deck Inspection & Tune-Up', description: 'A structural check plus minor repairs to keep your deck safe for the season.', standardPrice: 350, discountPercentage: 20, requiredSignups: 5 },
  ],
  'Fencing Service': [
    { title: 'Fence Repair & Panel Replacement', description: 'Fix leaning posts and swap damaged panels to keep your fence line solid.', standardPrice: 550, discountPercentage: 14, requiredSignups: 5 },
    { title: 'Fence Staining & Weatherproofing', description: 'Clean and reseal wood fencing to resist rot and sun damage.', standardPrice: 650, discountPercentage: 20, requiredSignups: 8 },
    { title: 'Gate Hardware Tune-Up', description: 'Realign gates and replace worn hinges and latches.', standardPrice: 185, discountPercentage: 14, requiredSignups: 5 },
  ],
  'Landscaping': [
    { title: 'Seasonal Flower Bed Planting', description: "Planting of seasonal color beds chosen for Wake County's climate.", standardPrice: 265, discountPercentage: 14, requiredSignups: 6 },
    { title: 'Mulching & Bed Refresh', description: 'Fresh mulch and bed edging to make your landscaping pop.', standardPrice: 375, discountPercentage: 10, requiredSignups: 6 },
    { title: 'Landscape Design Consultation', description: "A full-yard design plan tailored to your home's style and sun exposure.", standardPrice: 250, discountPercentage: 14, requiredSignups: 7 },
  ],
  'Lawn Service': [
    { title: 'Weekly Mowing Plan', description: 'Consistent weekly mowing and edging through the growing season.', standardPrice: 55, discountPercentage: 15, requiredSignups: 8 },
    { title: 'Weed Control & Fertilization', description: 'A seasonal treatment plan to control weeds and green up your lawn.', standardPrice: 150, discountPercentage: 16, requiredSignups: 5 },
    { title: 'Aeration & Overseeding', description: 'Core aeration and overseeding to thicken up thin or patchy lawns.', standardPrice: 300, discountPercentage: 14, requiredSignups: 8 },
  ],
  'Pool Maintenance': [
    { title: 'Scheduled Pool Maintenance', description: 'Weekly cleaning, chemical balancing, and equipment checks all season long.', standardPrice: 115, discountPercentage: 15, requiredSignups: 5 },
    { title: 'Pool Opening Service', description: 'Get your pool ready for summer with a professional opening service.', standardPrice: 325, discountPercentage: 16, requiredSignups: 6 },
    { title: 'Green Pool Recovery', description: 'Shock treatment and filtration to bring a green or cloudy pool back to clear.', standardPrice: 450, discountPercentage: 20, requiredSignups: 5 },
  ],
  'Tree Service': [
    { title: 'Tree Trimming & Pruning', description: 'Professional pruning to improve tree health and reduce storm-damage risk.', standardPrice: 450, discountPercentage: 15, requiredSignups: 6 },
    { title: 'Stump Grinding', description: 'Grinding out old stumps so you can reclaim the yard space.', standardPrice: 175, discountPercentage: 17, requiredSignups: 6 },
    { title: 'Storm Damage Cleanup', description: 'Fast cleanup and hauling after storm-damaged limbs and trees.', standardPrice: 225, discountPercentage: 14, requiredSignups: 5 },
  ],
  'Electrical': [
    { title: 'Whole-Home Electrical Safety Inspection', description: 'A licensed electrician checks panels, outlets, and wiring for safety issues.', standardPrice: 200, discountPercentage: 18, requiredSignups: 7 },
    { title: 'Ceiling Fan & Fixture Installation', description: 'Swap out dated fixtures or add new ceiling fans, wired safely to code.', standardPrice: 225, discountPercentage: 12, requiredSignups: 6 },
    { title: 'Surge Protection Upgrade', description: 'Whole-panel surge protection to guard electronics from storm surges.', standardPrice: 300, discountPercentage: 19, requiredSignups: 8 },
  ],
  'Handyman Service': [
    { title: 'Honey-Do List Bundle', description: 'A half-day handyman visit to knock out a backlog of small repairs.', standardPrice: 350, discountPercentage: 11, requiredSignups: 7 },
    { title: 'Drywall Patch & Paint Touch-Up', description: 'Repair dings, holes, and scuffs with a seamless paint match.', standardPrice: 275, discountPercentage: 12, requiredSignups: 7 },
    { title: 'Furniture Assembly & Mounting', description: 'TV mounting, shelving, and flat-pack furniture assembly.', standardPrice: 175, discountPercentage: 15, requiredSignups: 8 },
  ],
  'HVAC Maintenance': [
    { title: 'AC Seasonal Tune-Up', description: 'A full inspection and tune-up to keep your system running efficiently through peak season.', standardPrice: 150, discountPercentage: 18, requiredSignups: 8 },
    { title: 'Duct Cleaning & Inspection', description: 'Clear dust and debris from ductwork to improve airflow and air quality.', standardPrice: 375, discountPercentage: 19, requiredSignups: 8 },
    { title: 'Thermostat Upgrade Install', description: 'Smart thermostat installation and setup for better temperature control.', standardPrice: 250, discountPercentage: 21, requiredSignups: 6 },
  ],
  'Plumbing': [
    { title: 'Whole-Home Plumbing Inspection', description: 'A licensed plumber checks supply lines, drains, and fixtures for leaks and wear.', standardPrice: 175, discountPercentage: 15, requiredSignups: 8 },
    { title: 'Drain Clearing Service', description: 'Clear slow or clogged drains in kitchens and bathrooms.', standardPrice: 200, discountPercentage: 13, requiredSignups: 6 },
    { title: 'Water Heater Flush & Inspection', description: "Flush sediment and inspect your water heater to extend its lifespan.", standardPrice: 200, discountPercentage: 16, requiredSignups: 7 },
  ],
  'Roofing': [
    { title: 'Roof Inspection & Report', description: 'A full roof inspection with photos and a written condition report.', standardPrice: 225, discountPercentage: 15, requiredSignups: 6 },
    { title: 'Minor Roof Repair', description: 'Patch small leaks, replace damaged shingles, and reseal flashing.', standardPrice: 350, discountPercentage: 17, requiredSignups: 5 },
    { title: 'Roof Moss & Algae Treatment', description: 'Treatment to remove and prevent moss and algae streaking on shingles.', standardPrice: 325, discountPercentage: 12, requiredSignups: 6 },
  ],
  'Solar Panel Installation': [
    { title: 'Solar Panel Cleaning & Inspection', description: 'Cleaning and performance inspection to keep panels running at peak output.', standardPrice: 300, discountPercentage: 12, requiredSignups: 6 },
    { title: 'Solar Consultation & Site Assessment', description: "An on-site assessment of your roof's solar potential and estimated savings.", standardPrice: 200, discountPercentage: 12, requiredSignups: 7 },
    { title: 'Solar System Health Check', description: 'A technician checks inverters, wiring, and output against expected performance.', standardPrice: 250, discountPercentage: 10, requiredSignups: 6 },
  ],
  'Home Security': [
    { title: 'Smart Doorbell Camera Install', description: 'Professional install and setup of a video doorbell with app configuration.', standardPrice: 175, discountPercentage: 15, requiredSignups: 5 },
    { title: 'Home Security Assessment', description: 'A walkthrough audit identifying vulnerable entry points and blind spots.', standardPrice: 150, discountPercentage: 18, requiredSignups: 6 },
    { title: 'Smart Lock Upgrade', description: 'Keyless smart lock installation on your front and back doors.', standardPrice: 450, discountPercentage: 16, requiredSignups: 7 },
  ],
  'Interior Design': [
    { title: 'Single-Room Design Consultation', description: 'An in-home consult with a mood board and furniture layout plan for one room.', standardPrice: 300, discountPercentage: 15, requiredSignups: 8 },
    { title: 'Color Consultation & Paint Plan', description: 'Professional color palette guidance for your whole home or a single space.', standardPrice: 225, discountPercentage: 13, requiredSignups: 7 },
    { title: 'Closet & Storage Redesign', description: 'A functional redesign to maximize closet and storage space.', standardPrice: 350, discountPercentage: 15, requiredSignups: 8 },
  ],
  'Moving Services': [
    { title: 'Local Move - 2 Movers & Truck', description: 'A local move within Wake County with two movers and a truck for up to 4 hours.', standardPrice: 420, discountPercentage: 12, requiredSignups: 5 },
    { title: 'Packing & Unpacking Service', description: 'Full packing service with quality materials, plus unpacking at your new home.', standardPrice: 650, discountPercentage: 12, requiredSignups: 5 },
    { title: 'Single-Item Furniture Delivery', description: 'Safe transport and placement for a couch, mattress, or large appliance.', standardPrice: 225, discountPercentage: 10, requiredSignups: 6 },
  ],
  'Painting': [
    { title: 'Interior Room Repaint', description: 'Two-coat professional repaint for a single room, prep and cleanup included.', standardPrice: 450, discountPercentage: 15, requiredSignups: 6 },
    { title: 'Exterior Trim & Shutter Painting', description: 'Refresh faded trim, shutters, and doors with weather-resistant paint.', standardPrice: 750, discountPercentage: 10, requiredSignups: 6 },
    { title: 'Cabinet Refinishing', description: 'Sand, prime, and repaint kitchen or bathroom cabinets for a like-new look.', standardPrice: 3200, discountPercentage: 18, requiredSignups: 4 },
  ],
  'Pest Control': [
    { title: 'Quarterly Pest Prevention', description: 'Ongoing exterior treatment to keep common pests out year-round.', standardPrice: 135, discountPercentage: 20, requiredSignups: 7 },
    { title: 'Termite Inspection', description: 'A full termite inspection with a written report, recommended before closing on a home.', standardPrice: 115, discountPercentage: 24, requiredSignups: 8 },
    { title: 'Mosquito Yard Treatment', description: 'Barrier spray treatment to cut down on mosquitoes for summer evenings outside.', standardPrice: 130, discountPercentage: 15, requiredSignups: 6 },
  ],
};

const CATEGORIES = Object.keys(DEAL_TEMPLATES);
const OFFERINGS_PER_BUSINESS_MIN = 2;
const OFFERINGS_PER_BUSINESS_MAX = 3;

// Simple djb2-style hash for deterministic (not random-per-run) offering
// selection, matching the pattern already used elsewhere for neighborhood
// pricing estimates.
const hashString = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  return hash;
};

function pickOfferings(businessId, category) {
  const templates = DEAL_TEMPLATES[category];
  const hash = hashString(businessId);
  const count = OFFERINGS_PER_BUSINESS_MIN + (hash % (OFFERINGS_PER_BUSINESS_MAX - OFFERINGS_PER_BUSINESS_MIN + 1));
  // Rotate through the template list starting at a business-specific offset so
  // consecutive businesses in the same category don't all get the same set.
  const start = hash % templates.length;
  const picked = [];
  for (let i = 0; i < Math.min(count, templates.length); i++) {
    picked.push(templates[(start + i) % templates.length]);
  }
  return picked;
}

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
  return task.result?.[0]?.items || [];
}

function extractServedCities(description, allCities) {
  const text = normalize(description);
  const found = allCities.filter(c => text.includes(normalize(c)));
  return found;
}

async function main() {
  const neighborhoods = JSON.parse(readFileSync(NEIGHBORHOODS_PATH, 'utf-8'));
  const statsFile = JSON.parse(readFileSync(NEIGHBORHOOD_STATS_PATH, 'utf-8'));
  const realStats = statsFile.neighborhoods || {};
  const allCities = [...new Set(neighborhoods.map(n => n.city))];

  // Pre-rank neighborhoods per city by real home count, biggest first.
  const neighborhoodsByCity = {};
  for (const city of allCities) {
    neighborhoodsByCity[city] = neighborhoods
      .filter(n => n.city === city)
      .map(n => ({ ...n, homeCount: realStats[n.id]?.homeCount ?? 0 }))
      .sort((a, b) => b.homeCount - a.homeCount);
  }

  // Resume support: skip individual (category, city) query pairs a prior run
  // already completed (e.g. after running out of DataForSEO balance mid-batch,
  // or a prior run that only covered a subset of cities), and keep existing
  // businesses' ids stable rather than renumbering everything from scratch —
  // those ids may already be referenced by real visitor activity (deal
  // requests) since going live. Older output files predate per-pair tracking;
  // for those, every category was queried against the original 8-city list,
  // so that's reconstructed as the starting "done" set.
  const LEGACY_CITIES = ['Raleigh', 'Cary', 'Apex', 'Wake Forest', 'Holly Springs', 'Garner', 'Morrisville', 'Fuquay-Varina'];
  let existingBusinesses = [];
  let existingServices = [];
  let doneQueryPairs = new Set();
  if (existsSync(OUT_PATH)) {
    const prior = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    existingBusinesses = prior.businesses || [];
    existingServices = prior.services || [];
    if (prior.queriedPairs) {
      doneQueryPairs = new Set(prior.queriedPairs);
    } else {
      const legacyCategories = new Set(existingBusinesses.map(b => b.category));
      for (const category of legacyCategories) {
        for (const city of LEGACY_CITIES) doneQueryPairs.add(`${category}|${city}`);
      }
    }
    console.log(`Resuming: ${existingBusinesses.length} businesses already ingested, ${doneQueryPairs.size} category/city pairs already queried.`);
  }

  const allPairs = [];
  for (const category of CATEGORIES) {
    for (const city of CITIES) allPairs.push({ category, city });
  }
  const remainingPairs = DEEPEN
    ? allPairs
    : allPairs.filter(({ category, city }) => !doneQueryPairs.has(`${category}|${city}`));
  if (DEEPEN) {
    console.log(`DEEPEN mode: re-querying all ${remainingPairs.length} category/city combinations at limit=${RESULTS_PER_QUERY}.`);
  }
  if (remainingPairs.length === 0) {
    console.log('All category/city combinations already queried — nothing to do.');
    return;
  }
  console.log(`Querying ${remainingPairs.length} remaining category/city combinations.\n`);

  const existingPlaceIds = new Set(existingBusinesses.map(b => b.placeId).filter(Boolean));
  const businessesByPlaceId = new Map();
  let queryCount = 0;
  let errorCount = 0;
  let alreadyKnownCount = 0;

  for (const { category, city } of remainingPairs) {
    queryCount++;
    const { lat, lng } = cityCentroid(city, neighborhoods);
    process.stdout.write(`[${queryCount}/${remainingPairs.length}] ${category} in ${city}... `);
    try {
      const items = await searchCategory(category, city, lat, lng);
      console.log(`${items.length} results`);
      doneQueryPairs.add(`${category}|${city}`);
      for (const item of items) {
        if (existingPlaceIds.has(item.place_id)) { alreadyKnownCount++; continue; }
        if (businessesByPlaceId.has(item.place_id)) continue; // first category match wins
        businessesByPlaceId.set(item.place_id, { item, category, foundInCity: city });
      }
    } catch (err) {
      errorCount++;
      console.log(`FAILED: ${err.message}`);
    }
  }

  console.log(`\n${queryCount} queries run, ${errorCount} failed, ${alreadyKnownCount} already-known businesses skipped, ${businessesByPlaceId.size} new unique real businesses found.`);

  const businesses = [...existingBusinesses];
  const services = [...existingServices];
  let bizIdx = existingBusinesses.reduce((max, b) => Math.max(max, Number(b.id.split('-').pop()) || 0), 0);

  for (const { item, category, foundInCity } of businessesByPlaceId.values()) {
    bizIdx++;
    const businessId = `real-biz-${bizIdx}`;
    const addressInfo = item.address_info || {};
    const servedCities = extractServedCities(item.description, allCities);
    const effectiveCities = servedCities.length > 0 ? servedCities : [foundInCity];

    businesses.push({
      id: businessId,
      placeId: item.place_id,
      name: item.title,
      logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=random`,
      category,
      address: item.address || [addressInfo.address, addressInfo.city, addressInfo.zip].filter(Boolean).join(', ') || undefined,
      phone: item.phone || undefined,
      description: item.description ? item.description.slice(0, 500) : undefined,
      isProspective: true,
      // Real Google rating/review count from their own public listing — not
      // fabricated. Omitted (shows "New") when DataForSEO has none on file.
      rating: item.rating?.value || undefined,
      reviewCount: item.rating?.votes_count || undefined,
    });

    const neighborhoodIds = [];
    for (const city of effectiveCities) {
      const top = (neighborhoodsByCity[city] || []).slice(0, NEIGHBORHOODS_PER_SERVED_CITY);
      neighborhoodIds.push(...top.map(n => n.id));
    }
    const uniqueNeighborhoodIds = [...new Set(neighborhoodIds)];

    const offerings = pickOfferings(businessId, category);
    offerings.forEach((template, offeringIdx) => {
      services.push({
        id: `real-srv-${bizIdx}-${offeringIdx + 1}`,
        businessId,
        neighborhoodIds: uniqueNeighborhoodIds,
        title: template.title,
        description: template.description,
        category,
        standardPrice: template.standardPrice,
        discountPercentage: template.discountPercentage,
        requiredSignups: template.requiredSignups,
        currentSignups: 0,
        signedUpUserIds: [],
        status: 'active',
        isProspective: true,
      });
    });
  }

  writeFileSync(OUT_PATH, JSON.stringify({ businesses, services, queriedPairs: [...doneQueryPairs] }, null, 2));
  console.log(`Wrote ${businesses.length} businesses and ${services.length} proposed deals to ${path.relative(process.cwd(), OUT_PATH)}.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

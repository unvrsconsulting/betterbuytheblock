#!/usr/bin/env node
// Turns a prospect (from prospect.mjs) into an editable outreach email draft.
// Writes a plain-text file per business to scripts/outreach/drafts/ — nothing
// sends. You review, fill the [bracketed] placeholders, and send from your
// own email/domain.
//
// Usage:
//   node --env-file=.env.local scripts/outreach/draft.mjs                 # draft all "new" prospects
//   node --env-file=.env.local scripts/outreach/draft.mjs --place-id XYZ  # draft one

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROSPECTS_PATH = path.join(__dirname, 'prospects.json');
const DRAFTS_DIR = path.join(__dirname, 'drafts');
const SITE_URL = 'https://betterbuytheblock.com';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--place-id') out.placeId = argv[++i];
  }
  return out;
}

async function fetchDemand() {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    console.warn('ADMIN_TOKEN not set — drafting without real demand data (run with --env-file=.env.local).');
    return { byCategory: {}, byNeighborhood: {}, items: [] };
  }
  try {
    const res = await fetch(`${SITE_URL}/api/deal-request?token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch live demand data (${err.message}) — drafting without it.`);
    return { byCategory: {}, byNeighborhood: {}, items: [] };
  }
}

function demandLineFor(prospect, demand) {
  // Real requests whose city matches this prospect's city, regardless of exact
  // category wording — a human reviewing the draft can judge relevance better
  // than a brittle string match, so this stays a simple filter.
  const matches = demand.items.filter(item =>
    (item.city || '').toLowerCase() === (prospect.city || '').toLowerCase()
  );
  if (matches.length === 0) return null;
  const services = [...new Set(matches.map(m => m.serviceName))].slice(0, 3);
  return `${matches.length} neighbor${matches.length === 1 ? '' : 's'} in ${prospect.city} recently requested: ${services.join(', ')}.`;
}

function buildDraft(prospect, demand) {
  const demandLine = demandLineFor(prospect, demand);
  const listingSnippet = prospect.listingDescription
    ? prospect.listingDescription.split('\n')[0].slice(0, 200)
    : null;

  const subject = demandLine
    ? `Free listing for ${prospect.name} on BetterByTheBlock — ${prospect.city} neighbors are already asking`
    : `Free listing for ${prospect.name} on BetterByTheBlock`;

  const lines = [
    `Subject: ${subject}`,
    '',
    `Hi ${prospect.name} team,`,
    '',
    `I came across your listing for ${prospect.name}${prospect.listedCategory ? ` (${prospect.listedCategory})` : ''} while building BetterByTheBlock — a free site where ${prospect.city} neighbors team up to unlock bulk-pricing discounts from local home service businesses.`,
    '',
  ];

  if (demandLine) {
    lines.push(demandLine, '');
  }

  if (listingSnippet) {
    lines.push(`Given what you already offer ("${listingSnippet}"), I think ${prospect.name} would be a strong fit.`, '');
  }

  lines.push(
    `Listing is free — no cost, no commitment, and you set your own pricing and discount thresholds. Sign up here: ${SITE_URL}`,
    '',
    'Happy to answer any questions.',
    '',
    '[Your name]',
    '[Your business mailing address — required for real outreach email, CAN-SPAM]',
    '',
    'Reply "remove" and I will not contact you again.',
  );

  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(PROSPECTS_PATH)) {
    console.error(`No prospects file found at ${PROSPECTS_PATH}. Run prospect.mjs first.`);
    process.exit(1);
  }
  const prospects = JSON.parse(readFileSync(PROSPECTS_PATH, 'utf-8'));
  const demand = await fetchDemand();

  const targets = args.placeId
    ? prospects.filter(p => p.placeId === args.placeId)
    : prospects.filter(p => p.status === 'new');

  if (targets.length === 0) {
    console.log(args.placeId ? 'No prospect found with that place_id.' : 'No prospects with status "new" — nothing to draft.');
    return;
  }

  if (!existsSync(DRAFTS_DIR)) mkdirSync(DRAFTS_DIR, { recursive: true });

  for (const prospect of targets) {
    const draft = buildDraft(prospect, demand);
    const fileName = `${prospect.placeId}.txt`;
    writeFileSync(path.join(DRAFTS_DIR, fileName), draft);
    prospect.status = 'drafted';
    prospect.draftPath = `scripts/outreach/drafts/${fileName}`;
    console.log(`Drafted: ${prospect.name} -> ${prospect.draftPath}`);
  }

  writeFileSync(PROSPECTS_PATH, JSON.stringify(prospects, null, 2) + '\n');
  console.log(`\n${targets.length} draft(s) written. Review and fill [bracketed] placeholders in scripts/outreach/drafts/ before sending anything.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

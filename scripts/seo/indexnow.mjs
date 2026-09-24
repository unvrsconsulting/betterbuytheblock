#!/usr/bin/env node
// Pings IndexNow (Bing, Yandex, Seznam, Naver) with the site's core URLs -
// home, guides hub, every guide, category pages - straight from the built
// sitemap-core.xml, so it can never drift from what's actually published.
// No account needed: ownership is proven by the key file served at
// https://betterbuytheblock.com/d5a9181174f87c80eb8e11d2ee230de7.txt (public/d5a9181174f87c80eb8e11d2ee230de7.txt).
//
// Run AFTER a deploy is live:   npm run seo:indexnow
// Google does not participate in IndexNow; this helps every other engine.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const KEY = 'd5a9181174f87c80eb8e11d2ee230de7';
const HOST = 'betterbuytheblock.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const core = readFileSync(path.join(__dirname, '..', '..', 'dist', 'sitemap-core.xml'), 'utf-8');
const urlList = [...core.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: submitted ${urlList.length} URLs -> HTTP ${res.status} (200/202 = accepted)`);
if (res.status >= 400) process.exit(1);

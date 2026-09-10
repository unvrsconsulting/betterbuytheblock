import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

// Turns a street address into lat/lng so the client can run it through
// findNearestNeighborhood (same util already used for "Use my current
// location"). The Census Geocoder is free, keyless, and US-only — a good
// fit since this app is Wake County, NC only — but it doesn't send
// Access-Control-Allow-Origin, so the browser can't call it directly. This
// just proxies the one request server-side.

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const RATE_LIMIT_KEY_PREFIX = 'rl:geocode:';
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const address = String((req.body || {}).address || '').trim();
  if (!address || address.length < 5) {
    return res.status(400).json({ error: 'A more complete address is needed.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  try {
    const limited = await withClient(async (client) => {
      const key = RATE_LIMIT_KEY_PREFIX + ip;
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      return count > RATE_LIMIT_MAX;
    });
    if (limited) {
      return res.status(429).json({ error: 'Too many address lookups, please try again later.' });
    }
  } catch (err) {
    console.error('geocode rate-limit check failed', err);
    // Fail open — a Redis hiccup shouldn't block a genuine signup.
  }

  try {
    const url = `${CENSUS_URL}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
    const censusRes = await fetch(url);
    if (!censusRes.ok) {
      return res.status(502).json({ error: 'Address lookup failed, try again.' });
    }
    const data = await censusRes.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) {
      return res.status(200).json({ matched: false });
    }
    return res.status(200).json({
      matched: true,
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      matchedAddress: match.matchedAddress,
    });
  } catch (err) {
    console.error('geocode lookup failed', err);
    return res.status(502).json({ error: 'Address lookup failed, try again.' });
  }
}

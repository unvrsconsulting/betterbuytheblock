import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { sendNotificationEmail, escapeHtml } from './_lib/email.js';

// Captures every real "Join Deal" / "Request Deal" click against a specific,
// already-existing service — the counterpart to /api/deal-request, which
// captures custom / not-yet-real deal requests instead. Keeping these as two
// separate lists (rather than one shared list with a type flag) mirrors how
// the two flows already work in the app: this one always has a serviceId,
// deal-request often doesn't. POST is public; GET is token-gated so only the
// site owner can pull the lead list for a given deal.

const LIST_KEY = 'deal_signups';
const MAX_ENTRIES = 20000;
const RATE_LIMIT_KEY_PREFIX = 'rl:deal_signup:';
const RATE_LIMIT_MAX = 10;
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
  if (req.method === 'POST') {
    const body = req.body || {};
    const { serviceId, serviceName, businessId, userId, userName, userEmail, neighborhoodId, city } = body;

    if (!serviceId || !userId) {
      return res.status(400).json({ error: 'serviceId and userId are required' });
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
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
      }
    } catch (err) {
      console.error('deal-signup rate-limit check failed', err);
      // Fail open on the rate limiter itself — a Redis hiccup shouldn't block a genuine join.
    }

    const entry = {
      serviceId: String(serviceId),
      serviceName: serviceName ? String(serviceName).slice(0, 200) : null,
      businessId: businessId ? String(businessId) : null,
      userId: String(userId),
      userName: userName ? String(userName).slice(0, 200) : null,
      userEmail: userEmail ? String(userEmail).slice(0, 200) : null,
      neighborhoodId: neighborhoodId ? String(neighborhoodId) : null,
      city: city ? String(city).slice(0, 100) : null,
      capturedAt: new Date().toISOString(),
    };

    try {
      await withClient(async (client) => {
        await client.lPush(LIST_KEY, JSON.stringify(entry));
        await client.lTrim(LIST_KEY, 0, MAX_ENTRIES - 1);
      });
    } catch (err) {
      console.error('deal-signup capture failed', err);
      // Fail soft — the visitor's own local join already succeeded above.
      return res.status(200).json({ ok: true, captured: false });
    }

    sendNotificationEmail(
      `New deal signup: ${entry.serviceName || entry.serviceId}`,
      `<h2>New deal signup</h2>
       <p><strong>Deal:</strong> ${escapeHtml(entry.serviceName || entry.serviceId)}</p>
       <p><strong>From:</strong> ${escapeHtml(entry.userName || entry.userId)}</p>
       ${entry.userEmail ? `<p><strong>Email:</strong> ${escapeHtml(entry.userEmail)}</p>` : ''}
       ${entry.city ? `<p><strong>City:</strong> ${escapeHtml(entry.city)}</p>` : ''}
       ${entry.businessId ? `<p><strong>Business ID:</strong> ${escapeHtml(entry.businessId)}</p>` : ''}`
    ).catch(() => {});

    return res.status(200).json({ ok: true, captured: true });
  }

  if (req.method === 'GET') {
    const token = req.query.token;
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    try {
      const items = await withClient(async (client) => {
        const raw = await client.lRange(LIST_KEY, 0, -1);
        return raw.map((r: string) => JSON.parse(String(r)));
      });

      const requestedServiceId = req.query.serviceId ? String(req.query.serviceId) : null;
      const filtered = requestedServiceId ? items.filter((i: any) => i.serviceId === requestedServiceId) : items;

      const byService: Record<string, number> = {};
      const byBusiness: Record<string, number> = {};
      for (const item of items) {
        if (item.serviceId) byService[item.serviceId] = (byService[item.serviceId] || 0) + 1;
        if (item.businessId) byBusiness[item.businessId] = (byBusiness[item.businessId] || 0) + 1;
      }

      return res.status(200).json({ count: filtered.length, byService, byBusiness, items: filtered });
    } catch (err) {
      console.error('deal-signup fetch failed', err);
      return res.status(500).json({ error: 'failed to read signups' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { sendNotificationEmail, escapeHtml } from './_lib/email.js';

// Every real "Request a Deal" submission from the live site lands here, so the
// owner can see aggregate real demand (which categories, which neighborhoods)
// instead of it being trapped in each visitor's own browser localStorage.
// POST is public (any visitor submitting a request); GET is token-gated so
// only the site owner can read the aggregated list.

const LIST_KEY = 'deal_requests';
const MAX_ENTRIES = 5000;
const RATE_LIMIT_KEY_PREFIX = 'rl:deal_request:';
const RATE_LIMIT_MAX = 5;
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
    const { serviceName, description, businessId, userId, userName, neighborhoodId, city, website } = body;

    // Honeypot: a real visitor never sees or fills this field (hidden via
    // CSS, not `type="hidden"`, so form-filling bots that skip hidden inputs
    // still trip it). Silently accept-and-drop rather than error, so a bot
    // can't tell the difference and adjust.
    if (website) {
      return res.status(200).json({ ok: true, captured: true });
    }

    if (!serviceName || !description || !userId) {
      return res.status(400).json({ error: 'serviceName, description, and userId are required' });
    }
    if (String(description).trim().length < 5) {
      return res.status(400).json({ error: 'description is too short' });
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
      console.error('deal-request rate-limit check failed', err);
      // Fail open on the rate limiter itself — a Redis hiccup shouldn't block
      // a genuine visitor's request.
    }

    const entry = {
      serviceName: String(serviceName).slice(0, 200),
      description: String(description).slice(0, 2000),
      businessId: businessId ? String(businessId) : null,
      userId: String(userId),
      userName: userName ? String(userName).slice(0, 200) : null,
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
      console.error('deal-request capture failed', err);
      // Fail soft — the visitor's own local request already succeeded via
      // localStorage; losing the aggregate copy shouldn't surface as an error.
      return res.status(200).json({ ok: true, captured: false });
    }

    // Fire-and-forget: a failed email should never block the response, since
    // the real data is already durably saved in Redis by this point.
    sendNotificationEmail(
      `New deal request: ${entry.serviceName}`,
      `<h2>New deal request</h2>
       <p><strong>Service:</strong> ${escapeHtml(entry.serviceName)}</p>
       <p><strong>From:</strong> ${escapeHtml(entry.userName || entry.userId)}</p>
       ${entry.city ? `<p><strong>City:</strong> ${escapeHtml(entry.city)}</p>` : ''}
       ${entry.businessId ? `<p><strong>Business ID:</strong> ${escapeHtml(entry.businessId)}</p>` : ''}
       <p><strong>Details:</strong></p>
       <p>${escapeHtml(entry.description)}</p>`
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

      const byCategory: Record<string, number> = {};
      const byNeighborhood: Record<string, number> = {};
      for (const item of items) {
        const key = item.serviceName || 'unknown';
        byCategory[key] = (byCategory[key] || 0) + 1;
        if (item.neighborhoodId) {
          byNeighborhood[item.neighborhoodId] = (byNeighborhood[item.neighborhoodId] || 0) + 1;
        }
      }

      return res.status(200).json({ count: items.length, byCategory, byNeighborhood, items });
    } catch (err) {
      console.error('deal-request fetch failed', err);
      return res.status(500).json({ error: 'failed to read requests' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

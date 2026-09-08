import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { sendNotificationEmail, escapeHtml } from './_lib/email';

const LIST_KEY = 'newsletter_signups';
const MAX_ENTRIES = 5000;
const RATE_LIMIT_KEY_PREFIX = 'rl:newsletter:';
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { email, zip } = req.body || {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'a valid email is required' });
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
    console.error('newsletter rate-limit check failed', err);
  }

  const entry = {
    email: String(email).slice(0, 200),
    zip: zip ? String(zip).slice(0, 20) : null,
    capturedAt: new Date().toISOString(),
  };

  try {
    await withClient(async (client) => {
      await client.lPush(LIST_KEY, JSON.stringify(entry));
      await client.lTrim(LIST_KEY, 0, MAX_ENTRIES - 1);
    });
  } catch (err) {
    console.error('newsletter capture failed', err);
    return res.status(200).json({ ok: true, captured: false });
  }

  sendNotificationEmail(
    `New cost guide newsletter signup`,
    `<h2>New newsletter signup</h2>
     <p><strong>Email:</strong> ${escapeHtml(entry.email)}</p>
     ${entry.zip ? `<p><strong>Zip:</strong> ${escapeHtml(entry.zip)}</p>` : ''}`
  ).catch(() => {});

  return res.status(200).json({ ok: true, captured: true });
}

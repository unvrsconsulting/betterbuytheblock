import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSessionTokenFromRequest,
  getSessionUserId,
  setSessionCookie,
  clearSessionCookie,
} from './_lib/auth.js';

// Real signup/login/logout, replacing the old "just type an email, no
// password, no server-side account" model. A user document lives at
// user:<id>; the password hash is kept in a separate auth:<id> key so it's
// never at risk of being included in a response that returns the user doc.
// user_email:<normalized email> is the uniqueness/login index.

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

async function checkRateLimit(ip: string, bucket: string): Promise<boolean> {
  try {
    return await withClient(async (client) => {
      const key = `rl:auth:${bucket}:${ip}`;
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
      return count > RATE_LIMIT_MAX;
    });
  } catch (err) {
    console.error('auth rate-limit check failed', err);
    return false; // fail open — a Redis hiccup shouldn't lock out real users
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

  // GET is only ever "me" — who does this session belong to, if anyone.
  if (req.method === 'GET') {
    const userId = await getSessionUserId(req);
    if (!userId) return res.status(200).json({ user: null });
    const user = await withClient<string | null>(client => client.get(`user:${userId}`));
    if (!user) return res.status(200).json({ user: null });
    return res.status(200).json({ user: JSON.parse(user) });
  }

  const { action } = req.body || {};

  if (action === 'signup') {
    if (await checkRateLimit(ip, 'signup')) {
      return res.status(429).json({ error: 'Too many attempts, please try again later.' });
    }
    const { email, password, user } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!user || !user.name || !user.type) {
      return res.status(400).json({ error: 'name and type are required.' });
    }

    try {
      const created = await withClient(async (client) => {
        const emailKey = `user_email:${normalizedEmail}`;
        const existing = await client.get(emailKey);
        if (existing) return null; // signal: email taken

        const userId = `user_${crypto.randomUUID()}`;
        const fullUser = { ...user, id: userId, email: normalizedEmail };
        const passwordHash = await hashPassword(String(password));

        await client.set(`user:${userId}`, JSON.stringify(fullUser));
        await client.set(`auth:${userId}`, passwordHash);
        await client.set(emailKey, userId);

        return fullUser;
      });

      if (!created) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }

      const token = await createSession(created.id);
      setSessionCookie(res, token);
      return res.status(200).json({ user: created });
    } catch (err) {
      console.error('signup failed', err);
      return res.status(500).json({ error: 'Signup failed, please try again.' });
    }
  }

  if (action === 'login') {
    if (await checkRateLimit(ip, 'login')) {
      return res.status(429).json({ error: 'Too many attempts, please try again later.' });
    }
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    try {
      const result = await withClient(async (client) => {
        const userId = await client.get(`user_email:${normalizedEmail}`);
        if (!userId) return null;
        const [userRaw, passwordHash] = await Promise.all([
          client.get(`user:${userId}`),
          client.get(`auth:${userId}`),
        ]);
        if (!userRaw || !passwordHash) return null;
        const valid = await verifyPassword(String(password || ''), passwordHash);
        if (!valid) return null;
        return JSON.parse(userRaw);
      });

      if (!result) {
        // Same message whether the email doesn't exist or the password is
        // wrong — don't let a login form be used to enumerate real accounts.
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      const token = await createSession(result.id);
      setSessionCookie(res, token);
      return res.status(200).json({ user: result });
    } catch (err) {
      console.error('login failed', err);
      return res.status(500).json({ error: 'Login failed, please try again.' });
    }
  }

  if (action === 'update') {
    const userId = await getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not signed in.' });

    // Whitelisted fields only — a client can never rewrite its own id, type,
    // email, or businessId link through this endpoint.
    const { updates } = req.body || {};
    const ALLOWED_FIELDS = ['name', 'neighborhoodId', 'address', 'phone', 'phoneVerified', 'interestedCategories', 'avatarUrl'];
    const safeUpdates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (updates && Object.prototype.hasOwnProperty.call(updates, field)) {
        safeUpdates[field] = updates[field];
      }
    }

    try {
      const updated = await withClient(async (client) => {
        const raw = await client.get(`user:${userId}`);
        if (!raw) return null;
        const merged = { ...JSON.parse(raw), ...safeUpdates };
        await client.set(`user:${userId}`, JSON.stringify(merged));
        return merged;
      });
      if (!updated) return res.status(404).json({ error: 'Account not found.' });
      return res.status(200).json({ user: updated });
    } catch (err) {
      console.error('profile update failed', err);
      return res.status(500).json({ error: 'Update failed, please try again.' });
    }
  }

  if (action === 'createBusinessIdentity') {
    // A business "account" is really just a second User doc (type BUSINESS)
    // paired to the same real, password-holding resident account — matches
    // the two-linked-accounts model the client already used when everything
    // was local-only. Ownership of the actual Business doc is checked
    // separately in businesses.ts via ownerUserId; this identity is a
    // display/role-switch convenience, not a second authenticated principal.
    const residentUserId = await getSessionUserId(req);
    if (!residentUserId) return res.status(401).json({ error: 'Not signed in.' });

    const { name, avatarUrl, businessId } = req.body || {};
    if (!businessId) return res.status(400).json({ error: 'businessId is required.' });

    try {
      const result = await withClient(async (client) => {
        const residentRaw = await client.get(`user:${residentUserId}`);
        if (!residentRaw) return null;
        const resident = JSON.parse(residentRaw);

        const businessUserId = `user_${crypto.randomUUID()}`;
        const businessUser = {
          id: businessUserId,
          name: name || resident.name,
          type: 'BUSINESS',
          avatarUrl: avatarUrl || resident.avatarUrl,
          email: resident.email,
          businessId,
          linkedUserId: residentUserId,
        };
        const updatedResident = { ...resident, linkedUserId: businessUserId };

        await client.set(`user:${businessUserId}`, JSON.stringify(businessUser));
        await client.set(`user:${residentUserId}`, JSON.stringify(updatedResident));
        return { businessUser, resident: updatedResident };
      });

      if (!result) return res.status(404).json({ error: 'Account not found.' });
      return res.status(200).json(result);
    } catch (err) {
      console.error('createBusinessIdentity failed', err);
      return res.status(500).json({ error: 'Failed to set up business account.' });
    }
  }

  if (action === 'getLinked') {
    // Lets a signed-in user fetch their OWN paired resident<->business
    // identity when it isn't already cached locally (e.g. logging into a
    // business account for the first time on a new device). Deliberately
    // narrow: only ever returns the caller's own linkedUserId, never an
    // arbitrary id someone passes in — there's no general "look up any user"
    // endpoint, since that would leak other people's name/email.
    const userId = await getSessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not signed in.' });

    try {
      const linkedUser = await withClient(async (client) => {
        const selfRaw = await client.get(`user:${userId}`);
        if (!selfRaw) return null;
        const self = JSON.parse(selfRaw);
        if (!self.linkedUserId) return null;
        const linkedRaw = await client.get(`user:${self.linkedUserId}`);
        return linkedRaw ? JSON.parse(linkedRaw) : null;
      });
      return res.status(200).json({ user: linkedUser });
    } catch (err) {
      console.error('getLinked failed', err);
      return res.status(500).json({ error: 'Failed to load linked account.' });
    }
  }

  if (action === 'logout') {
    const token = getSessionTokenFromRequest(req);
    if (token) await destroySession(token);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'unknown action' });
}

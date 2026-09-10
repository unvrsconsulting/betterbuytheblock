import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { createClient } from 'redis';

// Real, server-verified sessions — the thing the old "no password, no
// server-side account" model never had. A session is a random opaque token
// in an httpOnly cookie, mapped to a userId in Redis with a TTL. Nothing
// about identity is ever trusted from the client beyond "you're holding a
// valid session token" — see requireSession() below, which every mutating
// endpoint (create/update a business, publish a deal, join a deal) must call
// before trusting req.body's userId/businessId for anything.

const COOKIE_NAME = 'nn_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await withClient(client => client.set(`session:${token}`, userId, { EX: SESSION_TTL_SECONDS }));
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await withClient(client => client.del(`session:${token}`));
}

async function getUserIdForSession(token: string): Promise<string | null> {
  return withClient(client => client.get(`session:${token}`));
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function getSessionTokenFromRequest(req: VercelRequest): string | null {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

// Reads the session cookie and resolves it to a real userId — the only
// trustworthy source of "who is making this request." Returns null for a
// missing/expired/invalid session; callers decide whether that's fatal.
export async function getSessionUserId(req: VercelRequest): Promise<string | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  return getUserIdForSession(token);
}

// 401s the response and returns null when there's no valid session — the
// standard guard for any endpoint that mutates real data. Usage:
//   const userId = await requireSession(req, res); if (!userId) return;
export async function requireSession(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const userId = await getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Not signed in.' });
    return null;
  }
  return userId;
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

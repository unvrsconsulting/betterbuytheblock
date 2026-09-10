import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

// Thin proxy to Twilio Verify (https://www.twilio.com/docs/verify/api) so the
// client never sees TWILIO_AUTH_TOKEN. Two actions: 'send' starts a
// verification (Twilio texts a code to the phone), 'check' confirms the code
// the resident typed back in.
//
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID are not
// set yet — until they are, this responds 503 with configured:false rather
// than throwing, so the client can fall back to "phone entered, not
// verified" instead of blocking signup entirely. See AuthModal.tsx.

const RATE_LIMIT_KEY_PREFIX = 'rl:phone_verify:';
const RATE_LIMIT_MAX = 8;
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

// Normalizes a US phone number to E.164 (+1XXXXXXXXXX). Returns null if it
// isn't a plausible 10-digit US number — this app only serves Wake County, NC.
function toE164(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { accountSid, authToken, serviceSid } = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
  if (!accountSid || !authToken || !serviceSid) {
    return res.status(503).json({ configured: false, error: 'Phone verification is not set up yet.' });
  }

  const body = req.body || {};
  const action = body.action;
  const phone = toE164(body.phone);
  if (!phone) {
    return res.status(400).json({ error: 'Enter a valid 10-digit US phone number.' });
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
      return res.status(429).json({ error: 'Too many attempts, please try again later.' });
    }
  } catch (err) {
    console.error('phone-verify rate-limit check failed', err);
    // Fail open — a Redis hiccup shouldn't block a genuine signup.
  }

  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  if (action === 'send') {
    try {
      const twilioRes = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: phone, Channel: 'sms' }),
      });
      const data = await twilioRes.json();
      if (!twilioRes.ok) {
        console.error('Twilio send failed', data);
        return res.status(502).json({ error: data.message || 'Could not send verification code.' });
      }
      return res.status(200).json({ ok: true, status: data.status });
    } catch (err) {
      console.error('phone-verify send threw', err);
      return res.status(502).json({ error: 'Could not send verification code.' });
    }
  }

  if (action === 'check') {
    const code = String(body.code || '').trim();
    if (!code) {
      return res.status(400).json({ error: 'Enter the code you were sent.' });
    }
    try {
      const twilioRes = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: phone, Code: code }),
      });
      const data = await twilioRes.json();
      if (!twilioRes.ok) {
        return res.status(200).json({ ok: false, status: data.status || 'failed' });
      }
      return res.status(200).json({ ok: data.status === 'approved', status: data.status });
    } catch (err) {
      console.error('phone-verify check threw', err);
      return res.status(502).json({ error: 'Could not check verification code.' });
    }
  }

  return res.status(400).json({ error: "action must be 'send' or 'check'" });
}

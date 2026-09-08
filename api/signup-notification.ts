import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendNotificationEmail, escapeHtml } from './_lib/email.js';

// Fired once when a new local profile is created (resident or business),
// purely to let the site owner know real signups are happening - this
// endpoint doesn't persist anything itself, since the account already lives
// in the visitor's own browser (see services/localStore.ts). Best-effort:
// a failed or skipped notification never affects the signup itself, which
// has already succeeded locally by the time this is called.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { name, email, accountType, neighborhoodName, city } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const isBusiness = accountType === 'business';
  await sendNotificationEmail(
    `New ${isBusiness ? 'business' : 'resident'} signup: ${String(name).slice(0, 200)}`,
    `<h2>New ${isBusiness ? 'business' : 'resident'} signup</h2>
     <p><strong>Name:</strong> ${escapeHtml(String(name).slice(0, 200))}</p>
     <p><strong>Email:</strong> ${escapeHtml(String(email).slice(0, 200))}</p>
     ${neighborhoodName ? `<p><strong>Neighborhood:</strong> ${escapeHtml(String(neighborhoodName).slice(0, 200))}</p>` : ''}
     ${city ? `<p><strong>City:</strong> ${escapeHtml(String(city).slice(0, 100))}</p>` : ''}`
  ).catch(() => {});

  return res.status(200).json({ ok: true });
}

// Server-only. Never import this from client code (components/, App.tsx) —
// it reads CLOUDFLARE_EMAIL_API_TOKEN directly from process.env, and anything
// imported into the client bundle gets shipped to every visitor's browser.
// Only api/*.ts files (which run on Vercel's server, never in the browser)
// should import this.
//
// Sends via Cloudflare's Email Sending REST API (the paid Workers add-on
// covering betterbuytheblock.com), not a third-party provider — the token
// needs the "Email Sending: Edit" permission, scoped to this account only.

const ACCOUNT_ID = 'e01e02cacc3a7c2bbcc1ecb12ff5158b';
const SEND_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`;

// Cloudflare's docs only show a plain address for "from"/"to" — no
// "Name <email>" display-name syntax is documented, so we don't risk it.
const FROM = 'support@betterbuytheblock.com';
const TO = 'support@betterbuytheblock.com';

export async function sendNotificationEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!apiKey) {
    console.warn('CLOUDFLARE_EMAIL_API_TOKEN not set, skipping email');
    return;
  }
  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: TO, subject, html }),
    });
    if (!res.ok) {
      console.error(`Email failed (${res.status}):`, await res.text());
    }
  } catch (err) {
    // A failed email should never take down the form submission it's
    // attached to - the real data is already saved by the time this runs.
    console.error('Email send threw:', err);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

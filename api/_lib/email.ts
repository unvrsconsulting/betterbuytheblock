// Server-only. Never import this from client code (components/, App.tsx) —
// it reads RESEND_API_KEY directly from process.env, and anything imported
// into the client bundle gets shipped to every visitor's browser. Only
// api/*.ts files (which run on Vercel's server, never in the browser) should
// import this.

const FROM = 'BetterBuyTheBlock <support@betterbuytheblock.com>';
const TO = 'support@betterbuytheblock.com';

export async function sendNotificationEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
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

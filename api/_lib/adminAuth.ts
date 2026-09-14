import type { VercelRequest, VercelResponse } from '@vercel/node';

// Same single-token model as the existing admin gate in deal-signup.ts /
// deal-request.ts (AdminDashboard.tsx's login screen) - checked against
// process.env.ADMIN_TOKEN, no per-admin accounts. Accepts the token from a
// query param (GET, so it works in a plain fetch URL) or the request body
// (POST). Returns true and lets the caller proceed, or writes a 401 and
// returns false.
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const token = (req.query?.token as string) || (req.body && req.body.token) || '';
  if (!token || !process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'Invalid admin token.' });
    return false;
  }
  return true;
}

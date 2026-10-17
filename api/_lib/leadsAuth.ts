import type { VercelRequest } from '@vercel/node';
import { getDoc } from './db.js';
import { getSessionUserId } from './auth.js';

// Shared by api/deal-signup.ts and api/deal-request.ts GET handlers, so a
// business can pull its own leads without the site-owner-only ADMIN_TOKEN.
//
// Authorization is the real server session: the caller must be signed in
// and be the business document's ownerUserId (the resident account that
// created it in api/businesses.ts). Nothing client-held is trusted — the
// old scheme (a per-business leadsAccessKey bound trust-on-first-use) let
// any key through for a business that had never opened its leads, and the
// keys themselves were readable from the public GET /api/businesses list.
// Seed/directory businesses have no Redis document, so they never pass.
export async function authorizeBusinessLeadsAccess(
  req: VercelRequest,
  businessId: string
): Promise<'ok' | 'unauthenticated' | 'forbidden'> {
  const userId = await getSessionUserId(req);
  if (!userId) return 'unauthenticated';
  if (!businessId) return 'forbidden';
  const business = await getDoc<any>(`business:${businessId}`);
  if (!business || !business.ownerUserId || business.ownerUserId !== userId) return 'forbidden';
  return 'ok';
}

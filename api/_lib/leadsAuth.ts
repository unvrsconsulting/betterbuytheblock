// Shared by api/deal-signup.ts and api/deal-request.ts GET handlers, so a
// business can pull its own leads without the site-owner-only ADMIN_TOKEN.
//
// There's no real server-side account system here (see AuthModal.tsx —
// accounts are client-only, no passwords), so businessId alone can't be
// trusted as proof of identity: it's visible in URLs and not hard to guess.
// Business.leadsAccessKey (a random UUID generated once at business signup,
// see App.tsx) is the actual secret. This binds it to a businessId
// trust-on-first-use: whichever key shows up first for a given businessId
// wins and is remembered; every later request for that businessId must
// match it. A stranger who only knows a businessId still can't read those
// residents' names/emails without also knowing the key nobody ever displays.
export async function authorizeBusinessLeadsAccess(
  client: any,
  businessId: string,
  key: string
): Promise<boolean> {
  if (!businessId || !key) return false;
  const redisKey = `business_leads_key:${businessId}`;
  // NX: only sets if absent, so a race between two first-ever requests can't
  // let a second, different key silently overwrite the one that already won.
  const claimed = await client.set(redisKey, key, { NX: true });
  if (claimed === 'OK') return true;
  const existing = await client.get(redisKey);
  return existing === key;
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDoc, setDoc, getManyDocs, addToIndex, getIndexIds } from './_lib/db.js';
import { requireSession, getSessionUserId } from './_lib/auth.js';

// Real (non-seed) deals — created/edited through BusinessCreateDeal, joined
// through performDealJoin. Same reasoning as businesses.ts: a deal a
// business publishes has to be visible to, and joinable by, every visitor —
// not just the browser that created it. GET is public; create/update need
// real ownership of the business; join needs a real session (so
// signedUpUserIds always holds a real, server-known account id).

const INDEX_KEY = 'services_all';

function serviceKey(id: string) {
  return `service:${id}`;
}
function businessKey(id: string) {
  return `business:${id}`;
}
function byBusinessIndexKey(businessId: string) {
  return `services_by_business:${businessId}`;
}

async function appendBilling(businessId: string, transaction: any) {
  const business = await getDoc<any>(businessKey(businessId));
  if (!business) return;
  const next = { ...business, billingHistory: [...(business.billingHistory || []), transaction] };
  await setDoc(businessKey(businessId), next);
  return next;
}

async function assertOwnsBusiness(userId: string, businessId: string): Promise<boolean> {
  const business = await getDoc<any>(businessKey(businessId));
  return !!business && business.ownerUserId === userId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const ids = await getIndexIds(INDEX_KEY);
      const services = await getManyDocs(ids.map(serviceKey));
      return res.status(200).json({ services });
    } catch (err) {
      console.error('services list failed', err);
      return res.status(500).json({ error: 'Failed to load deals.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { action } = req.body || {};

  if (action === 'create') {
    const userId = await requireSession(req, res);
    if (!userId) return;

    const { service, businessId, chargeAmount, chargedNeighborhoodIds, chargedCities } = req.body || {};
    if (!service || !businessId) {
      return res.status(400).json({ error: 'service and businessId are required.' });
    }
    if (!(await assertOwnsBusiness(userId, businessId))) {
      return res.status(403).json({ error: "You don't own this business." });
    }

    try {
      const id = `srv_${crypto.randomUUID()}`;
      const fullService = { ...service, id, businessId, currentSignups: 0, signedUpUserIds: [] };
      await setDoc(serviceKey(id), fullService);
      await addToIndex(INDEX_KEY, id);
      await addToIndex(byBusinessIndexKey(businessId), id);

      let business = null;
      if (chargeAmount > 0) {
        business = await appendBilling(businessId, {
          id: `txn_${crypto.randomUUID()}`,
          date: new Date().toISOString(),
          dealId: id,
          dealTitle: fullService.title,
          neighborhoodIds: chargedNeighborhoodIds || [],
          cities: chargedCities || [],
          amount: chargeAmount,
          type: 'publish',
        });
      }
      return res.status(200).json({ service: fullService, business });
    } catch (err) {
      console.error('service create failed', err);
      return res.status(500).json({ error: 'Failed to publish deal.' });
    }
  }

  if (action === 'update') {
    const userId = await requireSession(req, res);
    if (!userId) return;

    const { serviceId, updates, chargeAmount, chargedNeighborhoodIds, chargedCities } = req.body || {};
    if (!serviceId || !updates) {
      return res.status(400).json({ error: 'serviceId and updates are required.' });
    }

    try {
      const existing = await getDoc<any>(serviceKey(serviceId));
      if (!existing) return res.status(404).json({ error: 'Deal not found.' });
      if (!(await assertOwnsBusiness(userId, existing.businessId))) {
        return res.status(403).json({ error: "You don't own this deal." });
      }

      // Never let an edit payload overwrite server-owned fields.
      const { id, businessId, currentSignups, signedUpUserIds, ...safeUpdates } = updates;
      const merged = { ...existing, ...safeUpdates };
      await setDoc(serviceKey(serviceId), merged);

      let business = null;
      if (chargeAmount > 0) {
        business = await appendBilling(existing.businessId, {
          id: `txn_${crypto.randomUUID()}`,
          date: new Date().toISOString(),
          dealId: serviceId,
          dealTitle: merged.title,
          neighborhoodIds: chargedNeighborhoodIds || [],
          cities: chargedCities || [],
          amount: chargeAmount,
          type: 'add_neighborhoods',
        });
      }
      return res.status(200).json({ service: merged, business });
    } catch (err) {
      console.error('service update failed', err);
      return res.status(500).json({ error: 'Failed to update deal.' });
    }
  }

  if (action === 'join') {
    const userId = await requireSession(req, res);
    if (!userId) return;

    const { serviceId } = req.body || {};
    if (!serviceId) return res.status(400).json({ error: 'serviceId is required.' });

    try {
      const existing = await getDoc<any>(serviceKey(serviceId));
      if (!existing) return res.status(404).json({ error: 'Deal not found.' });
      if ((existing.signedUpUserIds || []).includes(userId)) {
        return res.status(200).json({ service: existing }); // already joined — no-op, not an error
      }
      if (existing.closeAfterThreshold && existing.currentSignups >= existing.requiredSignups) {
        return res.status(409).json({ error: 'Signups for this deal are closed.' });
      }

      const merged = {
        ...existing,
        signedUpUserIds: [...(existing.signedUpUserIds || []), userId],
        currentSignups: (existing.currentSignups || 0) + 1,
      };
      await setDoc(serviceKey(serviceId), merged);
      return res.status(200).json({ service: merged });
    } catch (err) {
      console.error('service join failed', err);
      return res.status(500).json({ error: 'Failed to join deal.' });
    }
  }

  if (action === 'leave') {
    const userId = await requireSession(req, res);
    if (!userId) return;

    const { serviceId } = req.body || {};
    if (!serviceId) return res.status(400).json({ error: 'serviceId is required.' });

    try {
      const existing = await getDoc<any>(serviceKey(serviceId));
      if (!existing) return res.status(404).json({ error: 'Deal not found.' });
      if (existing.status === 'completed') {
        return res.status(409).json({ error: 'This deal is already completed.' });
      }
      const merged = {
        ...existing,
        signedUpUserIds: (existing.signedUpUserIds || []).filter((id: string) => id !== userId),
        currentSignups: Math.max(0, (existing.currentSignups || 0) - 1),
      };
      await setDoc(serviceKey(serviceId), merged);
      return res.status(200).json({ service: merged });
    } catch (err) {
      console.error('service leave failed', err);
      return res.status(500).json({ error: 'Failed to leave deal.' });
    }
  }

  return res.status(400).json({ error: 'unknown action' });
}

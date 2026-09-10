import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDoc, setDoc, getManyDocs, addToIndex, getIndexIds } from './_lib/db.js';
import { requireSession } from './_lib/auth.js';

// Real (non-seed) businesses — created through BusinessOnboarding, edited
// through BusinessEditProfile. GET is public (every visitor needs to see
// every real business's public listing, same as the static seed catalog);
// create/update require a real session and, for update, real ownership —
// the whole point of this endpoint existing is that a business's profile
// has to be visible to every visitor, not just the browser that created it.

const INDEX_KEY = 'businesses_all';

function businessKey(id: string) {
  return `business:${id}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const ids = await getIndexIds(INDEX_KEY);
      const businesses = await getManyDocs(ids.map(businessKey));
      return res.status(200).json({ businesses });
    } catch (err) {
      console.error('businesses list failed', err);
      return res.status(500).json({ error: 'Failed to load businesses.' });
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

    const { business } = req.body || {};
    if (!business || !business.name) {
      return res.status(400).json({ error: 'business.name is required.' });
    }

    try {
      const id = `biz_${crypto.randomUUID()}`;
      const fullBusiness = {
        ...business,
        id,
        ownerUserId: userId,
        leadsAccessKey: crypto.randomUUID(),
        billingHistory: [],
      };
      await setDoc(businessKey(id), fullBusiness);
      await addToIndex(INDEX_KEY, id);
      return res.status(200).json({ business: fullBusiness });
    } catch (err) {
      console.error('business create failed', err);
      return res.status(500).json({ error: 'Failed to create business.' });
    }
  }

  if (action === 'update') {
    const userId = await requireSession(req, res);
    if (!userId) return;

    const { businessId, updates } = req.body || {};
    if (!businessId || !updates) {
      return res.status(400).json({ error: 'businessId and updates are required.' });
    }

    try {
      const existing = await getDoc<any>(businessKey(businessId));
      if (!existing) return res.status(404).json({ error: 'Business not found.' });
      if (existing.ownerUserId !== userId) {
        return res.status(403).json({ error: "You don't own this business." });
      }

      // id/ownerUserId/leadsAccessKey/billingHistory are never touched by a
      // profile-edit payload — those are either server-assigned identity or
      // managed exclusively by other endpoints (services.ts for billing).
      const { id, ownerUserId, leadsAccessKey, billingHistory, ...safeUpdates } = updates;
      const merged = { ...existing, ...safeUpdates };
      await setDoc(businessKey(businessId), merged);
      return res.status(200).json({ business: merged });
    } catch (err) {
      console.error('business update failed', err);
      return res.status(500).json({ error: 'Failed to update business.' });
    }
  }

  return res.status(400).json({ error: 'unknown action' });
}

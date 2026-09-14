import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDoc, setDoc, getManyDocs, getIndexIds, withClient } from './_lib/db.js';
import { requireAdmin } from './_lib/adminAuth.js';

// Full view/edit/delete over real (server-backed) users and businesses, for
// the admin dashboard - separate from the per-account self-service editing
// in auth.ts/businesses.ts, which only ever touches the caller's own
// record. Everything here is gated by the single ADMIN_TOKEN, not a user
// session, and the field whitelists are intentionally wider since an admin
// is trusted to fix real data (a mistyped email, a wrong category) that a
// self-service endpoint wouldn't let anyone touch on their own account.

const USERS_ALL_KEY_PATTERN = 'user:*';
const BUSINESSES_INDEX_KEY = 'businesses_all';
const SERVICES_INDEX_KEY = 'services_all';

function userKey(id: string) {
  return `user:${id}`;
}
function businessKey(id: string) {
  return `business:${id}`;
}
function serviceKey(id: string) {
  return `service:${id}`;
}
function byBusinessIndexKey(businessId: string) {
  return `services_by_business:${businessId}`;
}

// No `users_all` index exists (see auth.ts - signup never wrote one), and
// backfilling it retroactively for every account created before this
// endpoint existed isn't reliable. A KEYS scan is the honest way to get a
// complete list here: this only ever runs on an infrequent admin page load,
// never a hot request path, so the usual "don't KEYS a production Redis"
// concern doesn't really apply at this scale.
async function listAllUserIds(): Promise<string[]> {
  return withClient(async (client) => {
    const keys: string[] = [];
    // node-redis's scanIterator yields a whole SCAN batch (an array of keys)
    // per iteration, not one key at a time - taking only the first element
    // of each batch silently dropped every other key in it.
    for await (const batch of client.scanIterator({ MATCH: USERS_ALL_KEY_PATTERN, COUNT: 200 })) {
      if (Array.isArray(batch)) keys.push(...batch);
      else keys.push(batch);
    }
    return keys.map(k => k.slice('user:'.length));
  });
}

const USER_ADMIN_FIELDS = ['name', 'email', 'type', 'neighborhoodId', 'address', 'phone', 'phoneVerified', 'interestedCategories', 'avatarUrl', 'businessId', 'linkedUserId'];
const BUSINESS_ADMIN_FIELDS = [
  'name', 'category', 'description', 'street', 'city', 'state', 'zip', 'email',
  'serviceAreaCities', 'serviceAreaNeighborhoodIds', 'offerings', 'coverImageUrl',
  'logoUrl', 'ownerUserId', 'leadsAccessKey', 'rating', 'reviewCount',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    const resource = req.query?.resource as string;
    try {
      if (resource === 'users') {
        const ids = await listAllUserIds();
        const users = await getManyDocs(ids.map(userKey));
        return res.status(200).json({ users });
      }
      if (resource === 'businesses') {
        const ids = await getIndexIds(BUSINESSES_INDEX_KEY);
        const businesses = await getManyDocs(ids.map(businessKey));
        return res.status(200).json({ businesses });
      }
      return res.status(400).json({ error: 'resource must be "users" or "businesses".' });
    } catch (err) {
      console.error('admin list failed', err);
      return res.status(500).json({ error: 'Failed to load data.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { action, id, updates } = req.body || {};

  if (action === 'updateUser') {
    if (!id) return res.status(400).json({ error: 'id is required.' });
    const safeUpdates: Record<string, unknown> = {};
    for (const field of USER_ADMIN_FIELDS) {
      if (updates && Object.prototype.hasOwnProperty.call(updates, field)) {
        safeUpdates[field] = updates[field];
      }
    }
    try {
      const result = await withClient(async (client) => {
        const raw = await client.get(userKey(id));
        if (!raw) return null;
        const existing = JSON.parse(raw);
        const merged = { ...existing, ...safeUpdates };
        await client.set(userKey(id), JSON.stringify(merged));
        // Email doubles as the login index (user_email:<email> -> id) - if
        // it changed, the old index entry would otherwise keep pointing
        // here while the new email has no way to log in at all.
        const normalizedNewEmail = typeof safeUpdates.email === 'string' ? safeUpdates.email.trim().toLowerCase() : null;
        const normalizedOldEmail = typeof existing.email === 'string' ? existing.email.trim().toLowerCase() : null;
        if (normalizedNewEmail && normalizedNewEmail !== normalizedOldEmail) {
          if (normalizedOldEmail) await client.del(`user_email:${normalizedOldEmail}`);
          await client.set(`user_email:${normalizedNewEmail}`, id);
        }
        return merged;
      });
      if (!result) return res.status(404).json({ error: 'User not found.' });
      return res.status(200).json({ user: result });
    } catch (err) {
      console.error('admin updateUser failed', err);
      return res.status(500).json({ error: 'Update failed.' });
    }
  }

  if (action === 'deleteUser') {
    if (!id) return res.status(400).json({ error: 'id is required.' });
    try {
      await withClient(async (client) => {
        const raw = await client.get(userKey(id));
        const existing = raw ? JSON.parse(raw) : null;
        await client.del(userKey(id));
        await client.del(`auth:${id}`);
        if (existing?.email) {
          await client.del(`user_email:${String(existing.email).trim().toLowerCase()}`);
        }
        // Best-effort unlink on the paired resident<->business account, so
        // it doesn't keep pointing at an id that no longer resolves.
        if (existing?.linkedUserId) {
          const linkedRaw = await client.get(userKey(existing.linkedUserId));
          if (linkedRaw) {
            const linked = JSON.parse(linkedRaw);
            delete linked.linkedUserId;
            await client.set(userKey(existing.linkedUserId), JSON.stringify(linked));
          }
        }
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('admin deleteUser failed', err);
      return res.status(500).json({ error: 'Delete failed.' });
    }
  }

  if (action === 'updateBusiness') {
    if (!id) return res.status(400).json({ error: 'id is required.' });
    const safeUpdates: Record<string, unknown> = {};
    for (const field of BUSINESS_ADMIN_FIELDS) {
      if (updates && Object.prototype.hasOwnProperty.call(updates, field)) {
        safeUpdates[field] = updates[field];
      }
    }
    try {
      const existing = await getDoc<any>(businessKey(id));
      if (!existing) return res.status(404).json({ error: 'Business not found.' });
      const merged = { ...existing, ...safeUpdates };
      await setDoc(businessKey(id), merged);
      return res.status(200).json({ business: merged });
    } catch (err) {
      console.error('admin updateBusiness failed', err);
      return res.status(500).json({ error: 'Update failed.' });
    }
  }

  if (action === 'deleteBusiness') {
    if (!id) return res.status(400).json({ error: 'id is required.' });
    try {
      const serviceIds = await getIndexIds(byBusinessIndexKey(id));
      await withClient(async (client) => {
        await client.del(businessKey(id));
        await client.sRem(BUSINESSES_INDEX_KEY, id);
        for (const serviceId of serviceIds) {
          await client.del(serviceKey(serviceId));
          await client.sRem(SERVICES_INDEX_KEY, serviceId);
        }
        await client.del(byBusinessIndexKey(id));
      });
      return res.status(200).json({ ok: true, deletedServiceCount: serviceIds.length });
    } catch (err) {
      console.error('admin deleteBusiness failed', err);
      return res.status(500).json({ error: 'Delete failed.' });
    }
  }

  return res.status(400).json({ error: 'unknown action' });
}

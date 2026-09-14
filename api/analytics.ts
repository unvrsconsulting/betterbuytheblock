import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withClient } from './_lib/db.js';
import { requireAdmin } from './_lib/adminAuth.js';

// Minimal first-party counters for the admin dashboard - not a full event
// log, just running totals in a few Redis hashes (one field per business /
// search term / city, HINCRBY'd on each real event). That's all "page
// visits per business" and "search counts by city and term" actually need,
// and it stays cheap at any volume since a hash read is one call regardless
// of how many fields it holds. POST is public (any real visitor can log
// their own view/search) but only ever increments a counter, never reads
// anything back; GET is admin-only.

const BUSINESS_VIEWS_KEY = 'analytics:business_views';
const SEARCH_TERMS_KEY = 'analytics:search_terms';
const SEARCH_CITIES_KEY = 'analytics:search_cities';

const MAX_FIELD_LENGTH = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const { type, businessId, term, city } = req.body || {};
    try {
      if (type === 'business_view') {
        if (!businessId || typeof businessId !== 'string') {
          return res.status(400).json({ error: 'businessId is required.' });
        }
        await withClient(client => client.hIncrBy(BUSINESS_VIEWS_KEY, businessId.slice(0, MAX_FIELD_LENGTH), 1));
        return res.status(200).json({ ok: true });
      }
      if (type === 'search') {
        const normalizedTerm = typeof term === 'string' ? term.trim().toLowerCase().slice(0, MAX_FIELD_LENGTH) : '';
        const normalizedCity = typeof city === 'string' ? city.trim().slice(0, MAX_FIELD_LENGTH) : '';
        if (!normalizedTerm && !normalizedCity) {
          return res.status(400).json({ error: 'term or city is required.' });
        }
        await withClient(async (client) => {
          if (normalizedTerm) await client.hIncrBy(SEARCH_TERMS_KEY, normalizedTerm, 1);
          if (normalizedCity) await client.hIncrBy(SEARCH_CITIES_KEY, normalizedCity, 1);
        });
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'type must be "business_view" or "search".' });
    } catch (err) {
      console.error('analytics log failed', err);
      // Analytics failing should never surface as a user-visible error -
      // the caller fires this and ignores the response either way.
      return res.status(200).json({ ok: false });
    }
  }

  if (req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      const [businessViews, searchTerms, searchCities] = await withClient(client => Promise.all([
        client.hGetAll(BUSINESS_VIEWS_KEY),
        client.hGetAll(SEARCH_TERMS_KEY),
        client.hGetAll(SEARCH_CITIES_KEY),
      ]));
      const toCounts = (obj: Record<string, string>) =>
        Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Number(v) || 0]));
      return res.status(200).json({
        businessViews: toCounts(businessViews),
        searchTerms: toCounts(searchTerms),
        searchCities: toCounts(searchCities),
      });
    } catch (err) {
      console.error('analytics read failed', err);
      return res.status(500).json({ error: 'Failed to load analytics.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

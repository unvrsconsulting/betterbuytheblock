import { Neighborhood, CityStats } from '../types';

const DATA_URL = '/data/wake-neighborhoods.json';
const STATS_URL = '/data/wake-neighborhood-stats.json';

let cache: Neighborhood[] | null = null;
let inflight: Promise<Neighborhood[]> | null = null;

// Simple djb2-style string hash — deterministic, so the same neighborhood id always
// produces the same estimated home count across sessions/reloads.
const hashString = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

// Real per-parcel home counts aren't available in the shipped dataset (see
// Neighborhood.estimatedHomes comment in types.ts), so this produces a stable,
// realistic-looking estimate (typical NC subdivision size range) for use only in
// weighting neighborhood-targeting price during deal creation — not a verified figure.
export const estimateHomeCount = (neighborhoodId: string): number => {
  const MIN_HOMES = 40;
  const MAX_HOMES = 650;
  const hash = hashString(neighborhoodId);
  return MIN_HOMES + (hash % (MAX_HOMES - MIN_HOMES + 1));
};

// $5 minimum, scaling with estimated reach — a neighborhood of ~100 homes costs about
// $7 to target, a large ~650-home neighborhood costs around $46.
export const estimateNeighborhoodPrice = (neighborhood: Neighborhood): number => {
  const homes = neighborhood.estimatedHomes ?? estimateHomeCount(neighborhood.id);
  return Math.max(5, Math.round(homes * 0.07));
};

// Same per-home rate as estimateNeighborhoodPrice, on real city-wide home counts
// (see CityStats) rather than a single neighborhood's — a whole city is a much
// bigger commitment, so the floor is proportionally higher. Falls back to a flat
// $150 when real stats haven't loaded yet for that city.
export const estimateCityPrice = (cityStats: CityStats | undefined): number => {
  if (!cityStats?.homeCount) return 150;
  return Math.max(75, Math.round(cityStats.homeCount * 0.07));
};

export const loadNeighborhoods = (): Promise<Neighborhood[]> => {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = Promise.all([
    fetch(DATA_URL).then(res => res.json()) as Promise<Neighborhood[]>,
    fetch(STATS_URL).then(res => res.json()).catch(() => ({ neighborhoods: {} })),
  ])
    .then(([data, statsFile]) => {
      const realStats: Record<string, NonNullable<Neighborhood['homeStats']>> = statsFile.neighborhoods || {};
      const withEstimates = data.map(n => {
        const homeStats = realStats[n.id];
        return {
          ...n,
          homeStats,
          // Real count where we have it (spatially joined to Wake County's own
          // parcel data); the pseudo-random fallback only covers the small slice
          // of neighborhoods that didn't match a current subdivision boundary.
          estimatedHomes: homeStats?.homeCount ?? n.estimatedHomes ?? estimateHomeCount(n.id),
        };
      });
      cache = withEstimates;
      inflight = null;
      return withEstimates;
    })
    .catch(err => {
      console.error('Failed to load neighborhoods', err);
      inflight = null;
      return [];
    });

  return inflight;
};

export const searchNeighborhoods = (
  list: Neighborhood[],
  query: string,
  limit = 8
): Neighborhood[] => {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);

  const startsWith: Neighborhood[] = [];
  const contains: Neighborhood[] = [];

  for (const n of list) {
    const name = n.name.toLowerCase();
    const city = n.city.toLowerCase();
    if (name.startsWith(q)) {
      startsWith.push(n);
    } else if (name.includes(q) || city.includes(q)) {
      contains.push(n);
    }
    if (startsWith.length >= limit) break;
  }

  return [...startsWith, ...contains].slice(0, limit);
};

export const groupByCity = (list: Neighborhood[]): Record<string, Neighborhood[]> => {
  const groups: Record<string, Neighborhood[]> = {};
  for (const n of list) {
    if (!groups[n.city]) groups[n.city] = [];
    groups[n.city].push(n);
  }
  return groups;
};

export const getCities = (list: Neighborhood[]): string[] => {
  return Array.from(new Set(list.map(n => n.city))).sort();
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export const findNearestNeighborhood = (
  list: Neighborhood[],
  lat: number,
  lng: number
): Neighborhood | null => {
  let nearest: Neighborhood | null = null;
  let nearestDist = Infinity;

  for (const n of list) {
    if (n.lat == null || n.lng == null) continue;
    const dist = haversineDistance(lat, lng, n.lat, n.lng);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = n;
    }
  }

  return nearest;
};

export const neighborhoodsWithinRadius = (
  list: Neighborhood[],
  lat: number,
  lng: number,
  radiusMiles: number
): Neighborhood[] => {
  return list.filter(n => {
    if (n.lat == null || n.lng == null) return false;
    return haversineDistance(lat, lng, n.lat, n.lng) <= radiusMiles;
  });
};

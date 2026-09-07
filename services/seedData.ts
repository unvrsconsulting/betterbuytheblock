import { Business, Service } from '../types';

// The real business/service catalog (523 businesses, 886 offerings) used to
// live as a literal array in constants.ts — over 1MB of JSON parsed as JS
// source, shipped to every visitor on first load regardless of whether their
// browser already had it cached in localStorage. It's fetched as static JSON
// instead now, same pattern as public/data/wake-neighborhoods.json.

const BUSINESSES_URL = '/data/seed-businesses.json';
const SERVICES_URL = '/data/seed-services.json';

let cache: { businesses: Business[]; services: Service[] } | null = null;
let inflight: Promise<{ businesses: Business[]; services: Service[] }> | null = null;

export const loadSeedData = (): Promise<{ businesses: Business[]; services: Service[] }> => {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = Promise.all([
    fetch(BUSINESSES_URL).then(res => res.json()) as Promise<Business[]>,
    fetch(SERVICES_URL).then(res => res.json()) as Promise<Service[]>,
  ])
    .then(([businesses, services]) => {
      cache = { businesses, services };
      inflight = null;
      return cache;
    })
    .catch(err => {
      console.error('Failed to load seed business/service data', err);
      inflight = null;
      return { businesses: [], services: [] };
    });

  return inflight;
};

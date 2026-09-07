import { CityStats } from '../types';

const DATA_URL = '/data/wake-city-stats.json';

let cache: Record<string, CityStats> | null = null;
let inflight: Promise<Record<string, CityStats>> | null = null;

export const loadCityStats = (): Promise<Record<string, CityStats>> => {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = fetch(DATA_URL)
    .then(res => res.json())
    .then((data: { cities: Record<string, CityStats> }) => {
      cache = data.cities || {};
      inflight = null;
      return cache;
    })
    .catch(err => {
      console.error('Failed to load city stats', err);
      inflight = null;
      return {};
    });

  return inflight;
};

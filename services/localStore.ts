const PREFIX = 'nn_';

// Bump this whenever the seed data in constants.ts changes shape or content
// (new/removed services, businesses, categories, etc). Every persisted key is
// wiped on mismatch so stale cached data from a previous seed never silently
// shadows the new demo data — without this, a returning user's browser keeps
// whatever was cached on their first visit forever, no matter how much the
// seed data in the codebase changes.
const SEED_VERSION = '15';

export const resetIfStaleSeed = (): void => {
  try {
    const storedVersion = localStorage.getItem(PREFIX + 'seedVersion');
    if (storedVersion === SEED_VERSION) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(PREFIX + 'seedVersion', SEED_VERSION);
  } catch (e) {
    console.warn('Failed to check/reset seed version.', e);
  }
};

export const loadState = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Failed to load local state for "${key}", using fallback.`, e);
    return fallback;
  }
};

export const saveState = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save local state for "${key}".`, e);
  }
};

export const clearState = (key: string): void => {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    console.warn(`Failed to clear local state for "${key}".`, e);
  }
};

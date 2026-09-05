import { loadState, saveState } from './localStore';

// Common profanity/slurs, kept lowercase. Matched as whole words only so
// legitimate words containing a substring (e.g. "classic") never false-positive.
const PROFANITY_LIST = [
  'fuck', 'fucking', 'fucked', 'shit', 'bullshit', 'bitch', 'asshole', 'ass',
  'bastard', 'dick', 'piss', 'cunt', 'cock', 'pussy', 'slut', 'whore',
  'fag', 'faggot', 'retard', 'retarded', 'nigger', 'nigga', 'spic', 'chink',
  'kike', 'wetback', 'damn', 'goddamn', 'douche', 'douchebag', 'twat',
];

const URL_PATTERN = /(https?:\/\/|www\.)\S+/i;
const REPEATED_CHAR_PATTERN = /(.)\1{6,}/;

export interface ModerationOptions {
  minLength?: number;
  maxLength?: number;
  allowUrls?: boolean;
  fieldName?: string;
}

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

const normalizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    // collapse common leetspeak substitutions so filters aren't trivially dodged
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export const checkContent = (text: string, options: ModerationOptions = {}): ModerationResult => {
  const { minLength = 0, maxLength = 2000, allowUrls = false, fieldName = 'This field' } = options;
  const trimmed = (text || '').trim();

  if (!trimmed) {
    return { allowed: false, reason: `${fieldName} can't be empty.` };
  }
  if (trimmed.length < minLength) {
    return { allowed: false, reason: `${fieldName} must be at least ${minLength} characters.` };
  }
  if (trimmed.length > maxLength) {
    return { allowed: false, reason: `${fieldName} must be under ${maxLength} characters.` };
  }

  const words = normalizeWords(trimmed);
  if (words.some(w => PROFANITY_LIST.includes(w))) {
    return { allowed: false, reason: 'Please remove inappropriate language before submitting.' };
  }

  if (!allowUrls && URL_PATTERN.test(trimmed)) {
    return { allowed: false, reason: 'Links aren\'t allowed here — please remove any URLs.' };
  }

  if (REPEATED_CHAR_PATTERN.test(trimmed)) {
    return { allowed: false, reason: 'Please remove repeated characters (looks like spam).' };
  }

  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 15) {
    const upper = letters.replace(/[^A-Z]/g, '');
    if (upper.length / letters.length > 0.7) {
      return { allowed: false, reason: 'Please avoid writing in all caps.' };
    }
  }

  return { allowed: true };
};

// Lightweight client-side rate limit for a given action key (e.g. a user+business
// pair), since there's no backend to enforce this server-side. Returns true if the
// action should be blocked as too-frequent, and records the attempt as a side effect
// when it isn't blocked.
export const isRateLimited = (key: string, minIntervalMs: number = 15000): boolean => {
  const storageKey = `rateLimit_${key}`;
  const last = loadState<number>(storageKey, 0);
  const now = Date.now();
  if (now - last < minIntervalMs) return true;
  saveState(storageKey, now);
  return false;
};

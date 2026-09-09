
import { Business, User, Service, UserType, Review } from './types';
import categoryGroupsData from './constants/categoryGroups.json';
import wakeCountyCitiesData from './constants/cities.json';

// Every business account starts with this simulated dollar balance, used to pay for
// neighborhood-targeting costs when publishing or expanding deals. Not real money —
// see the "no real payment processing" note on the Terms page.
export const STARTING_BUSINESS_BALANCE = 500;

// Real Wake County neighborhoods (see public/data/wake-neighborhoods.json). Used as
// the default location for a signed-out visitor before they pick their own.
export const DEMO_NEIGHBORHOOD_IDS = [
  'bedford-at-falls-river-raleigh-3', // Bedford at Falls River, Raleigh
  'carolina-preserve-at-amberly-cary', // Carolina Preserve at Amberly, Cary
  'westford-apex', // Westford, Apex
  'heritage-wake-forest', // Heritage, Wake Forest
  'twelve-oaks-holly-springs', // Twelve Oaks, Holly Springs
  'eagle-ridge-garner', // Eagle Ridge, Garner
  'breckenridge-morrisville', // Breckenridge, Morrisville
  'wendell-falls-wendell', // Wendell Falls, Wendell
];

const DEFAULT_NEIGHBORHOOD_ID = DEMO_NEIGHBORHOOD_IDS[0];

// Data lives in constants/categoryGroups.json so build-time scripts (which run
// under plain Node, not Vite/TS) can read the same category list without
// duplicating it — see scripts/seo/prerender.mjs.
export const CATEGORY_GROUPS: { name: string; categories: string[] }[] = categoryGroupsData;

// The 15 real Wake County cities services can be scoped to (see
// scripts/data/ingest-real-businesses.mjs CITIES + "Wake County" for
// unincorporated areas) — kept as static data (not fetched) so slug
// resolution for /category/<slug>/<city-slug> URLs works synchronously on
// first render, before any data fetch resolves.
export const WAKE_COUNTY_CITIES: string[] = wakeCountyCitiesData;

// Pre-launch site: no real businesses have joined yet, so there are no real deals to
// show. These are purely illustrative — a generic category + pricing mechanic, never
// attributed to a name, rating, review, or license, so nothing here can be mistaken
// for a real listing. Each one drives straight into the real "Request a Deal" flow.
// No reviews are seeded — see components/BusinessProfile.tsx's honest
// rating/review-count split for why (real Google rating, zero fabricated
// written reviews).
export const REVIEWS: Review[] = [];

// No real businesses have signed up yet — outreach starts real listings from zero,
// not from fabricated demo companies. See services/outreach/ for the prospecting system.
// The only seed "user" is an honest anonymous default — not a fabricated person — used
// so a signed-out visitor has somewhere real to land before they set their own
// neighborhood. Every other account on the site is created by a real signup.
export const USERS: User[] = [
  {
    id: 'guest',
    name: 'Guest',
    type: UserType.RESIDENT,
    avatarUrl: '',
    isAnonymous: true,
    neighborhoodId: DEFAULT_NEIGHBORHOOD_ID,
    wishlist: [],
    connections: [],
    connectionCode: '',
  },
];

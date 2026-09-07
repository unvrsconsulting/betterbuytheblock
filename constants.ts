
import { Business, User, Service, UserType, Review } from './types';
import { getCategoryImage } from './services/categoryImages';

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

export const CATEGORY_GROUPS = [
  {
    name: 'Cleaning & Maintenance',
    categories: [
      'Carpet Cleaning',
      'Cleaning & Maid Services',
      'Gutter Cleaning',
      'House Cleaning',
      'Power Washing',
      'Window Washing'
    ]
  },
  {
    name: 'Outdoor & Yard',
    categories: [
      'Deck or Porch',
      'Fencing Service',
      'Landscaping',
      'Lawn Service',
      'Pool Maintenance',
      'Tree Service'
    ]
  },
  {
    name: 'Home Systems & Repairs',
    categories: [
      'Electrical',
      'Handyman Service',
      'HVAC Maintenance',
      'Plumbing',
      'Roofing',
      'Solar Panel Installation'
    ]
  },
  {
    name: 'Other Services',
    categories: [
      'Home Security',
      'Interior Design',
      'Moving Services',
      'Painting',
      'Pest Control'
    ]
  }
];

// Pre-launch site: no real businesses have joined yet, so there are no real deals to
// show. These are purely illustrative — a generic category + pricing mechanic, never
// attributed to a name, rating, review, or license, so nothing here can be mistaken
// for a real listing. Each one drives straight into the real "Request a Deal" flow.
export interface ExampleDeal {
  category: string;
  title: string;
  description: string;
  standardPrice: number;
  discountPercentage: number;
  requiredSignups: number;
}

export const EXAMPLE_DEALS: ExampleDeal[] = [
  {
    category: 'House Cleaning',
    title: 'Bi-Weekly House Cleaning',
    description: 'A standing bi-weekly visit to keep kitchens, bathrooms, and living areas consistently clean.',
    standardPrice: 220,
    discountPercentage: 18,
    requiredSignups: 10,
  },
  {
    category: 'Lawn Service',
    title: 'Weekly Mowing Plan',
    description: 'Consistent weekly mowing and edging through the growing season.',
    standardPrice: 75,
    discountPercentage: 15,
    requiredSignups: 8,
  },
  {
    category: 'HVAC Maintenance',
    title: 'AC Seasonal Tune-Up',
    description: 'A full inspection and tune-up to keep your system running efficiently through peak season.',
    standardPrice: 180,
    discountPercentage: 18,
    requiredSignups: 8,
  },
  {
    category: 'Pest Control',
    title: 'Quarterly Pest Prevention',
    description: 'Ongoing exterior treatment to keep common pests out year-round.',
    standardPrice: 140,
    discountPercentage: 20,
    requiredSignups: 7,
  },
  {
    category: 'Handyman Service',
    title: 'Honey-Do List Bundle',
    description: 'A half-day handyman visit to knock out a backlog of small repairs.',
    standardPrice: 106,
    discountPercentage: 11,
    requiredSignups: 7,
  },
  {
    category: 'Power Washing',
    title: 'House Exterior Power Wash',
    description: 'A full siding wash to remove pollen, mildew, and grime from your home\'s exterior.',
    standardPrice: 253,
    discountPercentage: 20,
    requiredSignups: 10,
  },
];

export const getExampleDealImage = (category: string) => getCategoryImage(category, 400, 300);

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

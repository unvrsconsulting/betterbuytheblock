
export enum UserType {
  RESIDENT = 'RESIDENT',
  BUSINESS = 'BUSINESS',
}

export interface DealRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  serviceName: string;
  description: string;
  businessId?: string;
  status: 'pending' | 'accepted' | 'declined';
  date: string;
}

export type NotificationType =
  | 'unlocked'
  | 'close_to_unlocking'
  | 'expiring_soon'
  | 'deal_request_received'
  | 'deal_request_status'
  | 'deal_completed';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  serviceId?: string;
  businessId?: string;
  dealRequestId?: string;
  date: string;
  read: boolean;
}

export interface User {
  id: string;
  name: string;
  type: UserType;
  avatarUrl: string;
  // Resident-only — a business account has no neighborhood of its own.
  neighborhoodId?: string;
  email?: string;
  isAnonymous?: boolean;
  wishlist?: string[];
  connections?: string[];
  connectionCode?: string;
  dealRequests?: DealRequest[];
  businessId?: string;
  // Points to the paired account for the same person (resident <-> business),
  // so a business owner can switch back to their personal account and vice versa.
  linkedUserId?: string;
  // Per-notification-type on/off preference for this account. A type missing from
  // this map is treated as enabled — only explicit `false` entries suppress a type,
  // so existing users with no map yet keep receiving every notification as before.
  notificationPreferences?: Partial<Record<NotificationType, boolean>>;
}

export interface Neighborhood {
  id: string;
  name: string;
  city: string;
  lat?: number;
  lng?: number;
  // Real, per-neighborhood housing stats — Wake County parcel data spatially
  // joined to the subdivision's real boundary (see scripts/data/fetch-neighborhood-stats.mjs).
  // Absent for the small slice of neighborhoods that didn't match a current
  // subdivision boundary; estimatedHomes falls back to a pseudo-random estimate
  // for those only.
  homeStats?: {
    homeCount: number;
    avgAssessedValue: number;
    avgSqFt: number;
    avgYearBuilt: number;
  };
  // Home count used for neighborhood-targeting pricing — real (from homeStats)
  // when available, otherwise a stable pseudo-random fallback seeded by id.
  estimatedHomes?: number;
}

// Real, per-city housing stats from Wake County's own public parcel database
// (assessor GIS), single-family homes only — see scripts/data/fetch-city-stats.mjs.
// Not an estimate: homeCount and avgAssessedValue are real counts/averages over
// real parcels, refreshed periodically as county assessment data changes.
export interface CityStats {
  homeCount: number;
  avgAssessedValue: number;
  avgSqFt: number;
  avgYearBuilt: number;
}

export interface NeighborhoodAudience {
  id: string;
  name: string;
  neighborhoodIds: string[];
}

export interface Business {
  id: string;
  name: string;
  logoUrl: string;
  category?: string;
  address?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  website?: string;
  phone?: string;
  googleBusinessUrl?: string;
  galleryPhotoIds?: string[];
  highlights?: string[];
  memberships?: string[];
  isLicensed?: boolean;
  licenseNumber?: string;
  amenities?: string[];
  // Simulated dollar balance used to pay for neighborhood-targeting costs when
  // publishing or expanding a deal. Missing on older persisted records — callers
  // should fall back to STARTING_BUSINESS_BALANCE (see constants.ts) when absent.
  balance?: number;
  // Reverse-chronological is a display concern, not a storage concern — entries
  // are appended in the order they occur.
  billingHistory?: BillingTransaction[];
  // Real business (name/category/address/phone all real, sourced via
  // scripts/data/ingest-real-businesses.mjs) that has NOT signed up or agreed to
  // anything — an unconfirmed directory listing, not a partner. No rating/review/
  // license is ever fabricated for one of these; the UI must show a clear
  // "not yet confirmed" badge and never imply affiliation or endorsement.
  isProspective?: boolean;
  // Real photo (via Pexels, see scripts/data/fetch-images.mjs), matching one of
  // this business's own service offering images — never a generic/unrelated
  // stock photo. Falls back to the category default image when absent.
  coverImageUrl?: string;
}

export interface BillingTransaction {
  id: string;
  date: string;
  // Present for a deal-related charge ('publish' / 'add_neighborhoods'). Omitted
  // for a manual balance top-up ('add_funds'), which isn't tied to any deal.
  dealId?: string;
  dealTitle?: string;
  // The neighborhoods this specific charge paid to target — for a new deal, all
  // of them; for an edit, only the newly-added ones. Omitted for 'add_funds'.
  neighborhoodIds?: string[];
  amount: number;
  type: 'publish' | 'add_neighborhoods' | 'add_funds';
}

export interface Review {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  date: string;
  photos?: string[];
  isVerifiedNeighbor?: boolean;
}

export interface Service {
  id: string;
  businessId: string;
  neighborhoodIds: string[];
  // Which real Wake County cities this offering actually serves. A real
  // business typically serves its whole city, not just the handful of
  // neighborhoods listed in neighborhoodIds (kept small there to avoid
  // shipping every one of a city's ~1,000+ real neighborhoods per offering)
  // - so matching against a selected neighborhood checks this city list
  // too, not just neighborhoodIds membership.
  servedCities?: string[];
  title: string;
  description: string;
  category: string;
  standardPrice: number;
  discountPercentage: number;
  requiredSignups: number;
  currentSignups: number;
  signedUpUserIds: string[];
  isAIGenerated?: boolean;
  status?: 'active' | 'completed';
  expiresAt?: string;
  imageUrl?: string;
  views?: number;
  closeAfterThreshold?: boolean;
  // A proposed deal for a real (isProspective) business that never agreed to it —
  // an illustration of what they could offer, not a live offer. "Join" is
  // disabled; the UI routes into the real request flow instead (see
  // handleSignUp's isProspective branch in App.tsx).
  isProspective?: boolean;
}

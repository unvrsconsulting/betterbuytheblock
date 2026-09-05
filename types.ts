
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
  // Deterministic, estimated household count — real per-parcel counts aren't available
  // in the shipped dataset, so this is a stable pseudo-random estimate seeded by id,
  // used only to weight neighborhood-targeting price in the deal-creation flow.
  estimatedHomes?: number;
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
}

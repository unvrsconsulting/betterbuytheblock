import type { Business, Service, Neighborhood } from '../../types';

export const SITE_URL: string;

export function businessPath(business: Pick<Business, 'name'>): string;
export function servicePath(business: Pick<Business, 'name'>, service: Pick<Service, 'title'>): string;
export function neighborhoodPath(neighborhood: Pick<Neighborhood, 'id'>): string;
export function categoryPath(categoryName: string): string;
export function categoryCityPath(categoryName: string, cityName: string): string;
export function parseBusinessSlugFromPath(pathname: string): string | null;
export function parseServiceSlugFromPath(pathname: string): string | null;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown>;
export function buildLocalBusinessJsonLd(business: Business, canonicalUrl: string): Record<string, unknown>;
export function buildServiceJsonLd(service: Service, business: Business, canonicalUrl: string): Record<string, unknown>;
export function buildItemListJsonLd(
  items: { name: string; url: string }[],
  canonicalUrl: string
): Record<string, unknown>;

export interface BusinessPageContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index, follow' | 'noindex, follow';
  honestyBadge: string | null;
  honestyNote: string | null;
  services: Service[];
  jsonLd: Record<string, unknown>[];
}

export function getBusinessPageContent(business: Business, services: Service[]): BusinessPageContent;

export interface ServicePageContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index, follow' | 'noindex, follow';
  honestyBadge: string | null;
  honestyNote: string | null;
  jsonLd: Record<string, unknown>[];
}

export function getServicePageContent(business: Business, service: Service): ServicePageContent;

export interface NeighborhoodPageContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  statsSentence: string | null;
  robots: 'index, follow' | 'noindex, follow';
  services: Service[];
  jsonLd: Record<string, unknown>[];
}

export function getNeighborhoodPageContent(neighborhood: Neighborhood, services: Service[]): NeighborhoodPageContent;

export interface CategoryInsights {
  serviceCount: number;
  businessCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  avgDiscount: number | null;
}

export interface CategoryPageContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index, follow' | 'noindex, follow';
  services: Service[];
  insights: CategoryInsights | null;
  guides: Guide[];
  jsonLd: Record<string, unknown>[];
}

export function getCategoryPageContent(
  categoryName: string,
  cityName: string | null,
  allServices: Service[]
): CategoryPageContent;

// --- Guides (blog) ---

export interface Guide {
  slug: string;
  title: string;
  description: string;
  author: string;
  date: string;
  image: string;
  type: string;
  category?: string;
  intro?: string[];
  sections?: { heading: string; paragraphs: string[]; bullets?: string[]; linkLabel?: string; linkCategory?: string }[];
  closing?: string[];
}

export interface GuidePageContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  image: string;
  robots: 'index, follow';
  relatedGuides: Guide[];
  jsonLd: Record<string, unknown>[];
}

export interface GuidesHubContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index, follow';
  guides: Guide[];
  jsonLd: Record<string, unknown>[];
}

export const GUIDES_HUB_PATH: string;
export function guidePath(slug: string): string;
export function guideDateIso(dateStr: string): string | undefined;
export function getGuidesForCategory(categoryName: string, allGuides?: Guide[]): Guide[];
export function getRelatedGuides(guide: Guide, allGuides?: Guide[], categoryGroups?: { name: string; categories: string[] }[], limit?: number): Guide[];
export function getGuidePageContent(guide: Guide, allGuides?: Guide[], categoryGroups?: { name: string; categories: string[] }[]): GuidePageContent;
export function getGuidesHubContent(allGuides?: Guide[]): GuidesHubContent;
export function getCategoryInsights(services: Service[]): CategoryInsights | null;
export function describeInsights(insights: CategoryInsights | null, categoryName: string, cityName?: string | null): string | null;

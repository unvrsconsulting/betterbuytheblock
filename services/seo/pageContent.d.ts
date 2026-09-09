import type { Business, Service, Neighborhood } from '../../types';

export const SITE_URL: string;

export function businessPath(business: Pick<Business, 'name'>): string;
export function neighborhoodPath(neighborhood: Pick<Neighborhood, 'id'>): string;
export function categoryPath(categoryName: string): string;
export function categoryCityPath(categoryName: string, cityName: string): string;
export function parseBusinessSlugFromPath(pathname: string): string | null;

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown>;
export function buildLocalBusinessJsonLd(business: Business, canonicalUrl: string): Record<string, unknown>;
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

export interface CategoryPageContent {
  path: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robots: 'index, follow' | 'noindex, follow';
  services: Service[];
  jsonLd: Record<string, unknown>[];
}

export function getCategoryPageContent(
  categoryName: string,
  cityName: string | null,
  allServices: Service[]
): CategoryPageContent;

export function slugify(input: string): string;
export function buildSlugMap(names: string[]): Map<string, string>;
export function buildCategorySlugMap(categoryGroups: { name: string; categories: string[] }[]): Map<string, string>;
export function buildCitySlugMap(cityNames: string[]): Map<string, string>;

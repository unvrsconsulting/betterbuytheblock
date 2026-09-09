// Plain JS (no TypeScript) so this runs under plain Node with zero build step —
// imported both by the Vite/React app and by scripts/seo/prerender.mjs.

/**
 * @param {string} input
 * @returns {string}
 */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a slug -> canonical name map from a fixed, small list of names.
 * Throws if two names collide to the same slug (should never happen with the
 * real category/city lists, but fail loudly rather than silently mis-resolve).
 * @param {string[]} names
 * @returns {Map<string, string>}
 */
export function buildSlugMap(names) {
  const map = new Map();
  for (const name of names) {
    const slug = slugify(name);
    if (map.has(slug) && map.get(slug) !== name) {
      throw new Error(`slugify collision: "${name}" and "${map.get(slug)}" both slugify to "${slug}"`);
    }
    map.set(slug, name);
  }
  return map;
}

/**
 * @param {{ name: string, categories: string[] }[]} categoryGroups
 * @returns {Map<string, string>}
 */
export function buildCategorySlugMap(categoryGroups) {
  const allCategories = categoryGroups.flatMap(g => g.categories);
  return buildSlugMap(allCategories);
}

/**
 * @param {string[]} cityNames
 * @returns {Map<string, string>}
 */
export function buildCitySlugMap(cityNames) {
  return buildSlugMap(cityNames);
}

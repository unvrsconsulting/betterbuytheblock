// The big static catalogs in public/data/ are served with a one-year immutable Cache-Control (vercel.json), so
// a returning visitor never re-downloads them. That's only safe because the URL changes whenever the data does:
// __DATA_VERSION__ is a hash of the files' contents, computed at build time in vite.config.ts.
export const dataUrl = (file: string): string => `/data/${file}?v=${__DATA_VERSION__}`;

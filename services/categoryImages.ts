const CATEGORY_PHOTO_IDS: { match: string; id: string }[] = [
  { match: 'pool', id: '1576013551627-0cc20b96c2a7' },
  { match: 'lawn', id: '1592417817098-8fd3d9eb14a5' },
  { match: 'landscap', id: '1592417817098-8fd3d9eb14a5' },
  { match: 'yard', id: '1592417817098-8fd3d9eb14a5' },
  { match: 'clean', id: '1581578731548-c64695cc6952' },
  { match: 'maid', id: '1581578731548-c64695cc6952' },
  { match: 'roof', id: '1632759145351-1d592919f522' },
  { match: 'gutter', id: '1632759145351-1d592919f522' },
  { match: 'paint', id: '1562259949-e8e7689d7828' },
  { match: 'plumb', id: '1585704032915-c3400ca199e7' },
  { match: 'electric', id: '1621905251189-08b45d6a269e' },
  { match: 'pest', id: '1517842645767-c639042777db' },
  { match: 'tree', id: '1502082553048-f009c37129b9' },
  { match: 'wash', id: '1527515637462-cff94eecc1ac' },
  { match: 'hvac', id: '1581094288338-2314dddb7ece' },
  { match: 'air', id: '1581094288338-2314dddb7ece' },
  { match: 'heat', id: '1581094288338-2314dddb7ece' },
  { match: 'deck', id: '1600607687644-c7171b42498f' },
  { match: 'porch', id: '1600607687644-c7171b42498f' },
  { match: 'fenc', id: '1608303588026-884930af2559' },
  { match: 'handyman', id: '1504148455328-c376907d081c' },
  { match: 'security', id: '1558002038-1055907df827' },
  { match: 'interior', id: '1586023492125-27b2c045efd7' },
  { match: 'design', id: '1586023492125-27b2c045efd7' },
  { match: 'mov', id: '1600518464441-9154a4dea21b' },
  { match: 'solar', id: '1509391366360-2e959784a276' },
];

const DEFAULT_PHOTO_ID = '1513694203232-719a280e022f';

const buildUrl = (id: string, width: number, height: number) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop`;

export const buildUnsplashUrl = buildUrl;

export const DEFAULT_CATEGORY_IMAGE = buildUrl(DEFAULT_PHOTO_ID, 600, 300);

export const getCategoryImage = (category: string, width = 600, height = 300): string => {
  const categoryLower = (category || '').toLowerCase();
  const found = CATEGORY_PHOTO_IDS.find(({ match }) => categoryLower.includes(match));
  return buildUrl(found ? found.id : DEFAULT_PHOTO_ID, width, height);
};

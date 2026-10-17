// Rewrites the JSON catalogs Vite copied into dist/data/ without pretty-printing whitespace. The source files in
// public/data/ stay readable for diffs; visitors download (and parse) the compact copies. seed-services.json alone
// drops from ~4.3 MB to ~3.5 MB uncompressed.
import fs from 'fs';
import path from 'path';

const dir = path.resolve('dist/data');
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.json')) continue;
  const full = path.join(dir, file);
  const before = fs.statSync(full).size;
  fs.writeFileSync(full, JSON.stringify(JSON.parse(fs.readFileSync(full, 'utf8'))));
  console.log(`minified ${file}: ${before} -> ${fs.statSync(full).size} bytes`);
}

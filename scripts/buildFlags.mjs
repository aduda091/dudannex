/**
 * Copy the flag images the game actually uses into `public/flags/`.
 *
 * They live in `public/` rather than being imported, so Vite copies them
 * verbatim and the browser fetches only the handful you actually look at —
 * roughly 1-3kB each — instead of bundling half a megabyte into the JS.
 *
 * Source is `svg-country-flags` (public domain). The 100px PNGs are used in
 * preference to the SVGs: several SVGs carry very detailed coats of arms
 * (Serbia's is 181kB) which is absurd for something drawn 24px tall, and the
 * PNGs render identically everywhere without font or renderer surprises.
 *
 * Run: node scripts/buildFlags.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const world = require('../src/data/world.json');

const SOURCE = join(
  dirname(require.resolve('svg-country-flags/package.json')),
  'png100px',
);
const DEST = 'public/flags';

mkdirSync(DEST, { recursive: true });
// Start clean so a renamed or dropped country cannot leave a stale flag behind.
for (const file of readdirSync(DEST)) rmSync(join(DEST, file));

const missing = [];
const noCode = [];
let copied = 0;
let bytes = 0;

for (const country of world.countries) {
  if (!country.iso2) {
    noCode.push(country.name);
    continue;
  }
  const src = join(SOURCE, `${country.iso2}.png`);
  if (!existsSync(src)) {
    missing.push(`${country.name} (${country.iso2})`);
    continue;
  }
  copyFileSync(src, join(DEST, `${country.iso2}.png`));
  copied += 1;
}

for (const file of readdirSync(DEST)) {
  bytes += require('node:fs').statSync(join(DEST, file)).size;
}

console.log(`copied ${copied} flags into ${DEST} (${(bytes / 1024).toFixed(0)}kB total)`);
console.log('no ISO code, no flag:', noCode.join(', ') || 'none');
if (missing.length) {
  console.error('MISSING image for:', missing.join(', '));
  process.exit(1);
}

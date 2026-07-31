/** Spot-check the numeric -> alpha-2 mapping against known-tricky pairs. */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const world = require('../src/data/world.json');
const byName = new Map(world.countries.map((c) => [c.name, c]));

const EXPECTED = {
  Croatia: 'hr',
  Slovenia: 'si',
  Slovakia: 'sk',
  Serbia: 'rs',
  Switzerland: 'ch',
  Sweden: 'se',
  Austria: 'at',
  Australia: 'au',
  Niger: 'ne',
  Nigeria: 'ng',
  'United States of America': 'us',
  'United Kingdom': 'gb',
  Germany: 'de',
  Japan: 'jp',
  China: 'cn',
  India: 'in',
  Indonesia: 'id',
  Ireland: 'ie',
  Iceland: 'is',
  Israel: 'il',
  Iran: 'ir',
  Iraq: 'iq',
  Taiwan: 'tw',
  Palestine: 'ps',
  Kosovo: 'xk',
  'W. Sahara': 'eh',
  Greenland: 'gl',
  'South Africa': 'za',
  'South Korea': 'kr',
  'North Korea': 'kp',
  Mali: 'ml',
  Malta: undefined, // not on the 110m map at all
};

let bad = 0;
for (const [name, want] of Object.entries(EXPECTED)) {
  const c = byName.get(name);
  if (!c) {
    if (want !== undefined) {
      console.error(`  MISSING country: ${name}`);
      bad += 1;
    }
    continue;
  }
  if (c.iso2 !== want) {
    console.error(`  WRONG: ${name} -> ${c.iso2}, expected ${want}`);
    bad += 1;
  }
}

const withCode = world.countries.filter((c) => c.iso2);
const noImage = withCode.filter((c) => !existsSync(`public/flags/${c.iso2}.png`));
const dupes = new Map();
for (const c of withCode) dupes.set(c.iso2, (dupes.get(c.iso2) ?? 0) + 1);
const collisions = [...dupes].filter(([, n]) => n > 1);

console.log(`checked ${Object.keys(EXPECTED).length} known pairs, ${bad} wrong`);
console.log(`countries with a code: ${withCode.length}/${world.countries.length}`);
console.log('missing image:', noImage.map((c) => c.name).join(', ') || 'none');
console.log('duplicate codes:', collisions.map(([k, n]) => `${k}x${n}`).join(', ') || 'none');

if (bad || noImage.length || collisions.length) process.exit(1);
console.log('OK');

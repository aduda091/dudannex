/** Sanity check: every country on the map has stats, and vice versa. */
import { readFileSync } from 'node:fs';

const world = JSON.parse(readFileSync('src/data/world.json', 'utf8'));
const src = readFileSync('src/data/countryStats.ts', 'utf8');

const bt = String.fromCharCode(96);
const table = new RegExp(`const TABLE = ${bt}([^${bt}]*)${bt}`)
  .exec(src)[1]
  .trim()
  .split('\n')
  .map((l) => l.trim().split(/\s+/));

const statIds = new Set(table.map((r) => r[0]));
const worldIds = world.countries.map((c) => c.id);
const name = (id) => world.countries.find((c) => c.id === id)?.name ?? '?';

const missing = worldIds.filter((i) => !statIds.has(i));
const extra = [...statIds].filter((i) => !worldIds.includes(i));
const malformed = table.filter(
  (r) => r.length !== 5 || r.slice(1).some((v) => Number.isNaN(+v)),
);

console.log(`stats rows: ${table.length}  world countries: ${worldIds.length}`);
console.log('missing stats:', missing.map((i) => `${i} ${name(i)}`).join(', ') || 'none');
console.log('orphan stats:', extra.join(', ') || 'none');
console.log('malformed rows:', JSON.stringify(malformed) || 'none');

if (missing.length || extra.length || malformed.length) process.exit(1);
console.log('OK');

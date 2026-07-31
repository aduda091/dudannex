/**
 * Build-time step: turn the Natural Earth 110m topology into the compact
 * world description the game actually needs (geometry, adjacency, centroids).
 *
 * Land adjacency comes straight out of the topology (shared arcs == shared
 * border). Islands would otherwise be unreachable, so they get sea links to
 * their nearest mainlands, plus a curated list of famous straits so that
 * conquering the whole map stays possible.
 *
 * Run: node scripts/buildWorld.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature, neighbors } from 'topojson-client';
import { geoCentroid, geoPath, geoEquirectangular } from 'd3-geo';
import isoCountries from 'i18n-iso-countries';

const require = createRequire(import.meta.url);
const topo = require('world-atlas/countries-110m.json');

const geometries = topo.objects.countries.geometries;
const fc = feature(topo, topo.objects.countries);
const adjacency = neighbors(geometries);

// Countries that are separated by water but have always fought across it.
// Without these the map fragments into unreachable pockets.
const STRAITS = [
  ['826', '250'], // United Kingdom - France
  ['826', '372'], // United Kingdom - Ireland
  ['724', '504'], // Spain - Morocco
  ['380', '788'], // Italy - Tunisia
  ['300', '792'], // Greece - Turkey
  ['792', '196'], // Turkey - Cyprus
  ['818', '682'], // Egypt - Saudi Arabia
  ['887', '232'], // Yemen - Eritrea
  ['887', '706'], // Yemen - Somalia
  ['364', '784'], // Iran - UAE
  ['364', '414'], // Iran - Kuwait
  ['682', '368'], // Saudi Arabia - Iraq (land, kept for safety)
  ['356', '144'], // India - Sri Lanka
  ['458', '360'], // Malaysia - Indonesia
  ['458', '702'], // Malaysia - Singapore
  ['608', '158'], // Philippines - Taiwan
  ['360', '608'], // Indonesia - Philippines
  ['158', '156'], // Taiwan - China
  ['410', '392'], // South Korea - Japan
  ['392', '643'], // Japan - Russia
  ['643', '840'], // Russia - USA (Bering Strait)
  ['840', '192'], // USA - Cuba
  ['192', '332'], // Cuba - Haiti
  ['332', '388'], // Haiti - Jamaica
  ['630', '214'], // Puerto Rico - Dominican Republic
  ['170', '591'], // Colombia - Panama (land, kept for safety)
  ['862', '780'], // Venezuela - Trinidad & Tobago
  ['032', '152'], // Argentina - Chile (land, kept for safety)
  ['710', '450'], // South Africa - Madagascar
  ['508', '450'], // Mozambique - Madagascar
  ['036', '360'], // Australia - Indonesia
  ['036', '598'], // Australia - Papua New Guinea
  ['036', '554'], // Australia - New Zealand
  ['554', '242'], // New Zealand - Fiji
  ['242', '548'], // Fiji - Vanuatu
  ['548', '090'], // Vanuatu - Solomon Islands
  ['090', '598'], // Solomon Islands - Papua New Guinea
  ['752', '208'], // Sweden - Denmark
  ['578', '208'], // Norway - Denmark
  ['246', '752'], // Finland - Sweden
  ['352', '826'], // Iceland - United Kingdom
  ['352', '304'], // Iceland - Greenland
  ['304', '124'], // Greenland - Canada
  ['233', '246'], // Estonia - Finland
  ['428', '752'], // Latvia - Sweden
  ['616', '752'], // Poland - Sweden
  ['804', '792'], // Ukraine - Turkey (Black Sea)
  ['642', '792'], // Romania - Turkey (Black Sea)
  ['268', '804'], // Georgia - Ukraine (Black Sea)
  ['398', '031'], // Kazakhstan - Azerbaijan (Caspian)
  ['795', '364'], // Turkmenistan - Iran (land, kept for safety)
  ['104', '356'], // Myanmar - India (land, kept for safety)
  ['076', '024'], // Brazil - Angola (South Atlantic, historic route)
  ['232', '682'], // Eritrea - Saudi Arabia
];

// Natural Earth carries a few de-facto states with no ISO numeric code. They
// would all collapse onto the same "undefined" key, so they get synthetic ids.
const SYNTHETIC_IDS = {
  Kosovo: 'X01',
  'N. Cyprus': 'X02',
  Somaliland: 'X03',
};

// Uninhabited territory: rendered nowhere, playable never.
const EXCLUDED = new Set(['010', '260']); // Antarctica, Fr. S. Antarctic Lands

const idOf = (f) =>
  SYNTHETIC_IDS[f.properties.name] ?? String(f.id).padStart(3, '0');

/**
 * Lowercase ISO 3166-1 alpha-2 code, used to pick a flag image. Derived from
 * the numeric id rather than typed out by hand: 175 hand-written codes would
 * eventually put Slovakia's flag on Slovenia, and a confidently wrong flag is
 * worse than none in a game people might learn from.
 *
 * The de-facto states have no ISO code. Kosovo has a widely used user-assigned
 * one; the other two get no flag rather than a guess.
 */
const SYNTHETIC_ISO2 = { X01: 'xk', X02: null, X03: null };

const iso2Of = (id) => {
  if (id in SYNTHETIC_ISO2) return SYNTHETIC_ISO2[id];
  const alpha2 = isoCountries.numericToAlpha2(id);
  return alpha2 ? alpha2.toLowerCase() : null;
};

const byId = new Map();
const centroids = new Map();

fc.features.forEach((f, i) => {
  const id = idOf(f);
  byId.set(i, id);
  centroids.set(id, geoCentroid(f));
});

/** Great-circle distance in km between two [lon, lat] pairs. */
function haversine([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const links = new Map(); // id -> Set(id)
const link = (a, b) => {
  if (a === b) return;
  if (!links.has(a)) links.set(a, new Set());
  if (!links.has(b)) links.set(b, new Set());
  links.get(a).add(b);
  links.get(b).add(a);
};

fc.features.forEach((_, i) => {
  const a = byId.get(i);
  if (!links.has(a)) links.set(a, new Set());
  for (const j of adjacency[i]) link(a, byId.get(j));
});

const ids = [...byId.values()];
for (const [a, b] of STRAITS) {
  if (centroids.has(a) && centroids.has(b)) link(a, b);
}

// Any country still isolated gets bridged to its three nearest neighbours,
// so no landmass is permanently off the board.
for (const id of ids) {
  if (links.get(id).size > 0) continue;
  const c = centroids.get(id);
  const nearest = ids
    .filter((o) => o !== id)
    .map((o) => ({ o, d: haversine(c, centroids.get(o)) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 3);
  for (const { o } of nearest) link(id, o);
}

// Pre-project the geometry to flat SVG path strings. Doing it here keeps
// d3-geo and the 100kB topology out of the browser bundle entirely.
const WIDTH = 2000;
const HEIGHT = 1000;
// Fit to the inhabited world only — including Antarctica would squash
// everything else into the top two thirds of the viewport.
const visible = {
  type: 'FeatureCollection',
  features: fc.features.filter((f) => !EXCLUDED.has(idOf(f))),
};
const projection = geoEquirectangular().fitSize([WIDTH, HEIGHT], visible);
const path = geoPath(projection);

const countries = fc.features
  .filter((f) => !EXCLUDED.has(idOf(f)))
  .map((f) => {
    const id = idOf(f);
    const [cx, cy] = projection(centroids.get(id));
    return {
      id,
      name: f.properties.name,
      iso2: iso2Of(id),
      d: path(f),
      cx: Math.round(cx * 10) / 10,
      cy: Math.round(cy * 10) / 10,
      neighbors: [...links.get(id)].filter((n) => !EXCLUDED.has(n)).sort(),
    };
  });

mkdirSync('src/data', { recursive: true });
writeFileSync(
  'src/data/world.json',
  JSON.stringify({ width: WIDTH, height: HEIGHT, countries }),
);

const isolated = countries.filter((c) => c.neighbors.length === 0);
console.log(`wrote ${countries.length} countries, ${isolated.length} isolated`);
console.log(
  'sample:',
  countries
    .filter((c) => ['191', '840', '036'].includes(c.id))
    .map((c) => `${c.name}(${c.neighbors.length})`)
    .join(' '),
);
writeFileSync(
  'scripts/country-list.txt',
  countries.map((c) => `${c.id}\t${c.name}`).join('\n'),
);

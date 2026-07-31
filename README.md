# Dudannex

An incremental strategy game played on a map of the real world. You take command
of one country — its actual population, economy and armed forces — build it up,
and annex your neighbours one border at a time until the map is one colour.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## How it plays

You start by picking any of the 175 countries on the map. Croatia is a good
first game: small, industrial, and hemmed in by five neighbours of very
different strengths.

**Industry** is the master resource. A slider on the Empire tab splits your
industrial output between the **treasury**, which pays for buildings, and
**recruitment**, which turns output into soldiers. That trade-off is the core
decision of the game — guns or factories.

**Research** accumulates on its own and buys technologies, which raise your
multipliers and unlock the better buildings.

**War** is fought by declaring on any country bordering your territory. Both
armies grind each other down in real time and you can order a withdrawal at any
point. Winning annexes the country: its borders become yours, and it starts
contributing half its economy immediately.

You begin able to run one offensive at a time. Staff College, Theatre Command
and the Orbital Command Network each raise that, up to ten simultaneous fronts,
and Field Army Headquarters buys more at a steeply rising price. Each front
fights independently — losing one does not affect the others — and the attack
dialog defaults to committing a comfortable winning margin rather than your
whole army, so there is something left to open the next front with.

Motorisation, Strategic Airlift and the Motor Transport Pool cut how long a
campaign takes to cover its ground, down to a floor of a quarter of the base
time. Shorter campaigns also cost fewer casualties, since you bleed for every
second you are in the field.

### The three things that stop you snowballing

A conquest game where each win makes the next one easier is over in five
minutes. Three mechanics pace it:

1. **Integration.** A freshly annexed country contributes 50% of its economy and
   manpower. That climbs to 100% over several minutes, faster with civic
   technologies.
2. **Occupation garrisons.** Territory that is not yet integrated ties down
   troops who cannot join an attack. Annex somewhere big and most of the
   manpower it gives you is immediately spent policing it — your *deployable*
   army is what matters, not your total.
3. **Campaign length.** Destroying an army is not the same as occupying a
   country. Every campaign takes time proportional to the target's population,
   however lopsided the odds, and you take casualties for the whole march.
4. **The world rearms.** Every country you do not own is building too.

### How the world fights back

Each unowned country adds its own production to its army over time, so large
economies rearm fast and minor ones barely move — the United States gains
hundreds of troops a second late on, Montenegro almost nothing.

How hard the whole world pushes is set by *your industrial output measured
against the entire planet's*, from a fifth of the baseline pace when you are
nobody up to a hard ceiling once you dominate. Territory share would be the
wrong trigger: the great powers are always the last countries standing, so it
stays near zero for most of a run and the world would only wake up when it no
longer mattered. Industry compounds from your first factory, so it tracks how
dangerous you actually look.

No country can pass ten times the army it started with. That rail never binds
in normal play — it is there because your own ceiling only climbs with the
logarithm of banked industry while enemy growth is linear in time, so without
it, leaving the game running for long enough could make a save unwinnable.

### Combat

Both sides lose troops in proportion to the other's strength — Lanchester's
square law — so the attacker wins exactly when `attack · A² > defence · D²`.
That makes outcomes predictable enough to plan around, and the attack dialog
shows you an honest forecast before you commit: the minimum force that wins,
expected survivors, and how long it will take. Per-tick noise of ±15% keeps
close fights interesting.

Defenders get a ×1.15 bonus for fighting at home.

## Saving

Progress is written to `localStorage` every five seconds and on tab close, and
the economy keeps running while you are away (credited on your next visit, up to
four hours).

The **Save** tab exports the whole game as readable JSON that you can paste into
a text file and back in later. There is no database and no server.

## Where the numbers come from

Every country carries four real figures — population, nominal GDP, active
military personnel, and defence budget — in
[`src/data/countryStats.ts`](src/data/countryStats.ts). They are approximate
2024/25 values from the usual public sources (Wikipedia's lists of countries by
population, GDP and military expenditure, and the IISS figures those cite).
They exist to give each country a plausible relative weight; only the ratios
between them matter to the game.

Everything else is derived from those four numbers: industry from GDP, research
from GDP scaled by GDP per head, and army strength from personnel plus budget
(weighted towards budget, since equipment decides fights).

## Map data

Borders come from Natural Earth's 110m dataset via
[`world-atlas`](https://www.npmjs.com/package/world-atlas).
`scripts/buildWorld.mjs` turns the topology into
[`src/data/world.json`](src/data/world.json) at build time:

- **Adjacency** is computed from the topology itself — in TopoJSON, countries
  that share a border share an arc, so who-borders-whom falls out for free.
- **Sea links** are added on top, because pure land adjacency leaves islands
  unreachable and splits the map into pockets you could never conquer. There is
  a curated list of straits people have historically crossed (Dover, Gibraltar,
  Bering, Malacca…), plus a fallback that bridges any country left with no
  neighbours at all to its three nearest.
- **Geometry** is pre-projected to flat SVG path strings, which keeps `d3-geo`
  and the topology out of the browser bundle entirely.

Regenerate it with:

```bash
node scripts/buildWorld.mjs
```

`node scripts/validateData.mjs` checks that every country on the map has stats
and vice versa.

## Flags

Flags appear beside country names in the picker, the war list, your territory
list, the country drawer and the war room. They come from
[`svg-country-flags`](https://www.npmjs.com/package/svg-country-flags) (public
domain), copied into `public/flags/` by `scripts/buildFlags.mjs` — 173 images,
about 490kB in total, each fetched only when something on screen needs it.

The 100px PNGs are used rather than the SVGs: several SVG flags carry very
detailed coats of arms (Serbia's is 181kB) which is absurd for something drawn
at 14px, and PNGs render identically everywhere. Emoji flags were not an option
— Chrome on Windows renders them as bare letter pairs.

Each flag is displayed at a fixed height with its own natural width, because
flags are not a common shape: Croatia is 2:1, Brazil 10:7, Switzerland square.
Forcing them into one box would crop or stretch them.

The ISO 3166-1 alpha-2 codes that name the files are derived from the numeric
ids by `i18n-iso-countries` during `buildWorld.mjs`, not typed by hand — 175
hand-written codes would eventually put Slovakia's flag on Slovenia.
`scripts/checkFlags.mjs` asserts a set of known-confusable pairs and that every
code has an image.

N. Cyprus and Somaliland have no ISO code and render no flag rather than a
guess.

```bash
node scripts/buildFlags.mjs   # refresh public/flags from the package
node scripts/checkFlags.mjs   # verify the mapping
```

## Balance harness

`scripts/simulate.ts` plays the game headlessly with a greedy bot and prints
pacing milestones. It is how the numbers above were tuned — a perfect bot with
no idle time takes roughly 20–40 minutes to take the world, depending on where
it starts. North Korea is the hard opening: a huge army, no economy to replace
it, and nothing but great powers on its borders.

```bash
npx esbuild scripts/simulate.ts --bundle --platform=node --loader:.json=json --outfile=sim.cjs
node sim.cjs 191 12     # country id, hour budget
```

## Layout

| Path | What's in it |
| --- | --- |
| `src/game/engine.ts` | Simulation: economy, combat, conquest, offline catch-up |
| `src/game/content.ts` | Every building and technology |
| `src/game/types.ts` | State and content shapes |
| `src/game/save.ts` | localStorage and JSON import/export |
| `src/state/GameProvider.tsx` | Tick loop and actions |
| `src/components/WorldMap.tsx` | Pan/zoom SVG map |
| `src/data/` | Generated world geometry, hand-written country stats |

## Known limits

The rest of the world builds but does not think: countries rearm on schedule
and defend when attacked, but they never research, never expand, and never
declare war on you. Damage you inflict on an army you fail to finish is kept —
they rebuild from the wreckage rather than from full strength. The obvious next
step is letting them take territory of their own.

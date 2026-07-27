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

## Balance harness

`scripts/simulate.ts` plays the game headlessly with a greedy bot and prints
pacing milestones. It is how the numbers above were tuned — a perfect bot with
no idle time takes roughly an hour and a half to take the world, from any
starting country.

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

This is the first iteration, and the world is a punching bag: other countries
never build, research, or attack you. They only defend, and any damage you do
to an army you fail to finish off is permanent. An obvious next step is giving
the rest of the world an economy and a reason to object.

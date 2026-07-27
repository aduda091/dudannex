/**
 * Headless balance harness. Plays a greedy bot and reports pacing milestones.
 *
 * Build & run:  npx esbuild scripts/simulate.ts --bundle --platform=node
 *               --loader:.json=json --outfile=<tmp>/sim.cjs && node <tmp>/sim.cjs
 */
import {
  ALL_BUILDINGS,
  TOTAL_COUNTRIES,
  build,
  buildingCost,
  countryName,
  createInitialState,
  derive,
  declareWar,
  enemyArmy,
  fmtDuration,
  fmtShort,
  forecast,
  isBuildingUnlocked,
  isTechAvailable,
  research,
  startGame,
  tick,
} from '../src/game/engine';
import { TECHS } from '../src/game/content';
import type { GameState } from '../src/game/types';

const HOME = process.argv[2] ?? '191';
const MAX_HOURS = Number(process.argv[3] ?? 12);

const state: GameState = createInitialState();
startGame(state, HOME);

/** Rough value-per-cost heuristic so the bot buys something sensible. */
function pickBuilding(s: GameState): string | null {
  let best: { id: string; score: number } | null = null;
  const d = derive(s);
  for (const b of ALL_BUILDINGS) {
    if (!isBuildingUnlocked(s, b.id)) continue;
    const cost = buildingCost(s, b.id);
    if (cost > s.industry) continue;
    const e = b.effects;
    // Convert every effect into "extra industry-equivalent per second".
    const value =
      (e.prodFlat ?? 0) +
      (e.prodMult ?? 0) * d.industryRate +
      ((e.resFlat ?? 0) + (e.resMult ?? 0) * d.researchRate) * 6 +
      ((e.manpowerFlat ?? 0) + (e.manpowerMult ?? 0) * d.armyCap) * 0.05 +
      (e.effMult ?? 0) * 2 +
      (e.convMult ?? 0) * d.recruitRate +
      (e.assimMult ?? 0) * 1.5 +
      (e.popMult ?? 0) * 0.5;
    const score = value / cost;
    if (!best || score > best.score) best = { id: b.id, score };
  }
  return best?.id ?? null;
}

const milestones: string[] = [];
let seen = 1;
const DT = 0.5;
let elapsed = 0;
const limit = MAX_HOURS * 3600;

while (elapsed < limit && Object.keys(state.owned).length < TOTAL_COUNTRIES) {
  tick(state, DT);
  elapsed += DT;

  // Research anything affordable, cheapest first.
  for (const t of [...TECHS].sort((a, b) => a.cost - b.cost)) {
    if (isTechAvailable(state, t.id) && state.research >= t.cost) research(state, t.id);
  }

  // Spend industry once there is a comfortable buffer.
  const pick = pickBuilding(state);
  if (pick) build(state, pick);

  // Attack the weakest reachable target when the odds are comfortable.
  if (!state.battle || state.battle.outcome !== 'ongoing') {
    state.battle = null;
    const d = derive(state);
    const targets = d.frontier
      .map((id) => ({ id, army: enemyArmy(state, id) }))
      .sort((a, b) => a.army - b.army);
    for (const t of targets) {
      const f = forecast(state, t.id, d.deployable);
      if (f.win && d.deployable > f.required * 1.25) {
        declareWar(state, t.id, d.deployable);
        break;
      }
    }
  }

  const count = Object.keys(state.owned).length;
  if (count > seen) {
    seen = count;
    if ([2, 5, 10, 25, 50, 100, 150, TOTAL_COUNTRIES].includes(count)) {
      const d = derive(state);
      milestones.push(
        `${String(count).padStart(3)} countries @ ${fmtDuration(elapsed).padEnd(10)} ` +
          `industry ${fmtShort(d.industryRate).padStart(8)}/s  ` +
          `research ${fmtShort(d.researchRate).padStart(8)}/s  ` +
          `army ${fmtShort(d.deployable).padStart(8)}(+${fmtShort(d.garrison)}g)/${fmtShort(d.armyCap)}  ` +
          `techs ${state.techs.length}`,
      );
    }
  }
}

const d = derive(state);
console.log(`\n=== ${countryName(HOME)} — greedy bot, ${MAX_HOURS}h budget ===\n`);
console.log(milestones.join('\n'));
console.log(
  `\nfinal: ${Object.keys(state.owned).length}/${TOTAL_COUNTRIES} countries after ${fmtDuration(elapsed)}`,
);
console.log(
  `industry ${fmtShort(d.industryRate)}/s  research ${fmtShort(d.researchRate)}/s  ` +
    `army ${fmtShort(d.deployable)} deployable (+${fmtShort(d.garrison)} garrison)/${fmtShort(d.armyCap)}  techs ${state.techs.length}/${TECHS.length}  ` +
    `battles ${state.battlesWon}W/${state.battlesLost}L`,
);
if (Object.keys(state.owned).length < TOTAL_COUNTRIES) {
  const d2 = derive(state);
  const stuck = d2.frontier
    .map((id) => ({ id, army: enemyArmy(state, id), req: forecast(state, id, d2.deployable).required }))
    .sort((a, b) => a.req - b.req)
    .slice(0, 5);
  console.log(
    '\nblocked on:',
    stuck.map((s) => `${countryName(s.id)} (need ${fmtShort(s.req)})`).join(', '),
  );
}

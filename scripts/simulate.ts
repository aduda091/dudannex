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

  // Clear concluded fronts, then fill every free one with the weakest target
  // we can beat, committing only what each needs so the rest stay available.
  state.battles = state.battles.filter((b) => b.outcome === 'ongoing');
  {
    const d = derive(state);
    let free = d.maxFronts - d.activeFronts;
    const engaged = new Set(state.battles.map((b) => b.targetId));
    const targets = d.frontier
      .filter((id) => !engaged.has(id))
      .map((id) => ({ id, army: enemyArmy(state, id) }))
      .sort((a, b) => a.army - b.army);

    for (const t of targets) {
      if (free <= 0) break;
      const available = derive(state).deployable;
      if (available <= 0) break;
      const f = forecast(state, t.id, available);
      if (!f.win) continue;
      // Send a comfortable margin, but never the whole army when more fronts
      // are still worth opening.
      const commit = Math.min(available, Math.max(f.required * 1.3, available / (free || 1)));
      if (declareWar(state, t.id, commit)) free -= 1;
    }
  }

  const count = Object.keys(state.owned).length;
  if (count > seen) {
    seen = count;
    if ([2, 5, 10, 25, 50, 100, 150, TOTAL_COUNTRIES].includes(count)) {
      const d = derive(state);
      const toughest = d.frontier
        .map((id) => enemyArmy(state, id))
        .reduce((a, b) => Math.max(a, b), 0);
      milestones.push(
        `${String(count).padStart(3)} @ ${fmtDuration(elapsed).padEnd(9)} ` +
          `ind ${fmtShort(d.industryRate).padStart(8)}/s ` +
          `army ${fmtShort(d.deployable).padStart(8)}/${fmtShort(d.armyCap).padEnd(8)} ` +
          `fronts ${d.maxFronts} ` +
          `camp -${(d.campaignSpeed * 100).toFixed(0).padStart(2)}% ` +
          `techs ${String(state.techs.length).padStart(2)} ` +
          `| world armed +${fmtShort(state.worldArmament).padStart(7)} ` +
          `toughest foe ${fmtShort(toughest).padStart(8)}`,
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

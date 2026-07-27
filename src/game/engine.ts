import worldRaw from '../data/world.json';
import {
  COUNTRY_STATS,
  baseMilitary,
  baseProduction,
  baseResearch,
} from '../data/countryStats';
import { BUILDINGS, BUILDING_BY_ID, TECH_BY_ID } from './content';
import type {
  Effects,
  GameState,
  LogEntry,
  WorldCountry,
  WorldData,
} from './types';

export const WORLD = worldRaw as WorldData;
export const COUNTRY_BY_ID = new Map<string, WorldCountry>(
  WORLD.countries.map((c) => [c.id, c]),
);
export const TOTAL_COUNTRIES = WORLD.countries.length;

// ---------------------------------------------------------------------------
// Tuning constants. These are the dials worth turning if pacing feels off.
// ---------------------------------------------------------------------------

/**
 * Your standing army may reach this multiple of the military potential of the
 * territory you hold. Potential — not population — because real armies track
 * budgets, not headcount: tying the ceiling to people would hand you an
 * unstoppable army the moment you annexed anywhere populous.
 */
const CAP_MULTIPLE = 2.5;
/**
 * Troops tied down policing territory that is not yet integrated, per point of
 * the occupied country's own military potential and per million of its people.
 *
 * This is the brake on conquest. A fresh annexation raises your ceiling and
 * immediately takes much of it back as an occupation garrison, so an empire
 * only converts into deployable strength as its territory comes to heel.
 */
const GARRISON_PER_POTENTIAL = 1.2;
const GARRISON_PER_MILLION = 0.12;
/**
 * Army raised per industry point spent, before logistics bonuses. Deliberately
 * low: industry scales with GDP far faster than armies do, so without an
 * expensive conversion the late game recruits a world-beating army in seconds.
 */
const BASE_CONVERSION = 0.15;
/** Defending on home soil is worth this much. */
export const DEFENDER_BONUS = 1.15;
/** Sets the pace of combat: an even fight takes roughly 1/k seconds. */
const COMBAT_K = 0.14;
/**
 * Destroying an army is not the same as occupying a country. However lopsided
 * the odds, a campaign still has to cover ground, and bigger countries take
 * longer. This floor on campaign length is what paces the whole game: without
 * it, an overwhelming force annexes a nation the instant war is declared.
 */
export function campaignLength(countryId: string): number {
  const pop = COUNTRY_STATS[countryId]?.pop ?? 1;
  return 15 + 10 * Math.log10(1 + pop);
}
/** Battles are integrated at this fixed step for stable, tick-rate-independent results. */
const COMBAT_STEP = 0.05;
/** Integration gained per second by a fresh conquest, before civic bonuses. */
const BASE_ASSIMILATION = 0.0012;
/**
 * Compounding population growth per second — roughly +15% an hour before
 * civic bonuses. It has to stay small: it multiplies the army ceiling, and
 * anything faster turns a long session into an exponential runaway.
 */
const BASE_POP_GROWTH = 0.00004;
/** How much of a conquered nation answers to you on day one. */
export const CONQUEST_SHARE = 0.5;
/** Building discounts cannot push costs below this fraction of base. */
const MIN_COST_FACTOR = 0.35;
/** Offline earnings are granted for at most this long. */
export const MAX_OFFLINE_SECONDS = 4 * 3600;

const ZERO_EFFECTS: Effects = {
  prodFlat: 0,
  prodMult: 0,
  resFlat: 0,
  resMult: 0,
  manpowerFlat: 0,
  manpowerMult: 0,
  effMult: 0,
  convMult: 0,
  popMult: 0,
  assimMult: 0,
  costRed: 0,
  lossRed: 0,
  garrisonRed: 0,
};

export function createInitialState(): GameState {
  return {
    version: 1,
    homeId: null,
    owned: {},
    industry: 0,
    research: 0,
    army: 0,
    popMultiplier: 1,
    buildings: {},
    techs: [],
    mobilization: 0.4,
    battle: null,
    damaged: {},
    lastTick: Date.now(),
    startedAt: Date.now(),
    battlesWon: 0,
    battlesLost: 0,
    log: [],
  };
}

export function startGame(state: GameState, homeId: string): void {
  const stats = COUNTRY_STATS[homeId];
  state.homeId = homeId;
  state.owned = { [homeId]: 1 };
  state.army = baseMilitary(stats);
  state.industry = 20;
  state.research = 0;
  state.startedAt = Date.now();
  state.lastTick = Date.now();
  pushLog(state, 'system', `${countryName(homeId)} takes the field.`);
}

export function countryName(id: string): string {
  return COUNTRY_BY_ID.get(id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export interface Derived {
  effects: Effects;
  /** Integration-weighted population, in millions. */
  population: number;
  /** Total industry points produced per second. */
  industryRate: number;
  /** Total research points produced per second. */
  researchRate: number;
  /** Industry points reaching the treasury per second. */
  treasuryRate: number;
  /** Army raised per second at the current mobilisation setting. */
  recruitRate: number;
  /** Ceiling on the standing army. */
  armyCap: number;
  /** Troops locked down policing occupied territory. */
  garrison: number;
  /** Troops actually available to attack with. */
  deployable: number;
  /** Army raised per industry point spent. */
  conversion: number;
  /** Multiplier applied to your army when it attacks. */
  attackMultiplier: number;
  territories: number;
  /** Countries you could declare war on right now. */
  frontier: string[];
}

export function accumulateEffects(state: GameState): Effects {
  const e: Effects = { ...ZERO_EFFECTS };
  const add = (partial: Partial<Effects>, times: number) => {
    for (const [k, v] of Object.entries(partial) as [keyof Effects, number][]) {
      e[k] += v * times;
    }
  };
  for (const techId of state.techs) {
    const tech = TECH_BY_ID.get(techId);
    if (tech) add(tech.effects, 1);
  }
  for (const [buildingId, count] of Object.entries(state.buildings)) {
    const def = BUILDING_BY_ID.get(buildingId);
    if (def && count > 0) add(def.effects, count);
  }
  return e;
}

export function derive(state: GameState): Derived {
  const effects = accumulateEffects(state);

  let population = 0;
  let prodBase = 0;
  let resBase = 0;
  let potential = 0;
  let garrisonNeed = 0;
  for (const [id, integration] of Object.entries(state.owned)) {
    const stats = COUNTRY_STATS[id];
    if (!stats) continue;
    population += stats.pop * integration;
    prodBase += baseProduction(stats) * integration;
    resBase += baseResearch(stats) * integration;
    potential += baseMilitary(stats) * integration;
    garrisonNeed +=
      (baseMilitary(stats) * GARRISON_PER_POTENTIAL +
        stats.pop * GARRISON_PER_MILLION) *
      (1 - integration);
  }
  population *= state.popMultiplier;
  potential *= state.popMultiplier;
  garrisonNeed *= state.popMultiplier;

  const industryRate = (prodBase + effects.prodFlat) * (1 + effects.prodMult);
  const researchRate = (resBase + effects.resFlat) * (1 + effects.resMult);
  const conversion = BASE_CONVERSION * (1 + effects.convMult);
  const armyCap =
    (potential * CAP_MULTIPLE + effects.manpowerFlat) *
    (1 + effects.manpowerMult);
  const garrison = garrisonNeed * Math.max(0.1, 1 - effects.garrisonRed);

  return {
    effects,
    population,
    garrison,
    deployable: Math.max(0, state.army - garrison),
    industryRate,
    researchRate,
    treasuryRate: industryRate * (1 - state.mobilization),
    recruitRate: industryRate * state.mobilization * conversion,
    armyCap,
    conversion,
    attackMultiplier: 1 + effects.effMult,
    territories: Object.keys(state.owned).length,
    frontier: frontierOf(state),
  };
}

/** Unowned countries that border something you own. */
export function frontierOf(state: GameState): string[] {
  const out = new Set<string>();
  for (const id of Object.keys(state.owned)) {
    for (const n of COUNTRY_BY_ID.get(id)?.neighbors ?? []) {
      if (!(n in state.owned)) out.add(n);
    }
  }
  return [...out];
}

/** Current army of an unowned country, accounting for damage you have done. */
export function enemyArmy(state: GameState, id: string): number {
  const stats = COUNTRY_STATS[id];
  if (!stats) return 0;
  return state.damaged[id] ?? baseMilitary(stats);
}

export function buildingCost(state: GameState, buildingId: string): number {
  const def = BUILDING_BY_ID.get(buildingId);
  if (!def) return Infinity;
  const owned = state.buildings[buildingId] ?? 0;
  const discount = Math.max(
    MIN_COST_FACTOR,
    1 - accumulateEffects(state).costRed,
  );
  return def.baseCost * def.growth ** owned * discount;
}

export function isBuildingUnlocked(state: GameState, buildingId: string): boolean {
  const def = BUILDING_BY_ID.get(buildingId);
  if (!def) return false;
  return !def.requires || state.techs.includes(def.requires);
}

export function isTechAvailable(state: GameState, techId: string): boolean {
  const def = TECH_BY_ID.get(techId);
  if (!def || state.techs.includes(techId)) return false;
  return def.requires.every((r) => state.techs.includes(r));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function pushLog(
  state: GameState,
  kind: LogEntry['kind'],
  text: string,
): void {
  state.log.unshift({ t: Date.now(), kind, text });
  if (state.log.length > 120) state.log.length = 120;
}

export function build(state: GameState, buildingId: string): boolean {
  const def = BUILDING_BY_ID.get(buildingId);
  if (!def || !isBuildingUnlocked(state, buildingId)) return false;
  const cost = buildingCost(state, buildingId);
  if (state.industry < cost) return false;
  state.industry -= cost;
  state.buildings[buildingId] = (state.buildings[buildingId] ?? 0) + 1;
  pushLog(
    state,
    'build',
    `${def.name} #${state.buildings[buildingId]} completed.`,
  );
  return true;
}

export function research(state: GameState, techId: string): boolean {
  const def = TECH_BY_ID.get(techId);
  if (!def || !isTechAvailable(state, techId)) return false;
  if (state.research < def.cost) return false;
  state.research -= def.cost;
  state.techs.push(techId);
  pushLog(state, 'tech', `${def.name} researched.`);
  return true;
}

export interface Forecast {
  /** Enemy army you would be facing. */
  defender: number;
  /** Smallest force that still wins, ignoring the ±15% combat noise. */
  required: number;
  win: boolean;
  /** Troops expected to march home if you win. */
  survivors: number;
  /** Rough seconds the battle would take. */
  duration: number;
}

/**
 * Both sides lose troops in proportion to the other's strength, which is
 * Lanchester's square law: the attacker wins exactly when
 * `attack · A² > defence · D²`. That makes the outcome predictable enough to
 * plan around, while the per-tick noise keeps close fights interesting.
 */
export function forecast(
  state: GameState,
  targetId: string,
  commit: number,
): Forecast {
  const { attackMultiplier, effects } = derive(state);
  const defender = enemyArmy(state, targetId);
  const lossFactor = Math.max(0.15, 1 - effects.lossRed);
  const defenceWeight = DEFENDER_BONUS * lossFactor;

  const gap = attackMultiplier * commit ** 2 - defenceWeight * defender ** 2;
  const lanchesterSurvivors = gap > 0 ? Math.sqrt(gap / attackMultiplier) : 0;
  // Time for the losing side to be wiped out, at the average of start and end
  // strength — close enough for a planning estimate.
  const lanchesterDuration =
    gap > 0
      ? defender /
        Math.max(
          1e-6,
          COMBAT_K * ((commit + lanchesterSurvivors) / 2) * attackMultiplier,
        )
      : commit / Math.max(1e-6, COMBAT_K * defender * defenceWeight);

  // If the shooting would be over before the campaign can physically advance,
  // the schedule takes over: the defence is ground down linearly and you bleed
  // for the whole march. Average enemy strength across it is half its start.
  const floorLength = campaignLength(targetId);
  const paced = gap > 0 && lanchesterDuration < floorLength;
  const pacedLosses = COMBAT_K * defenceWeight * (defender / 2) * floorLength;

  const required = Math.max(
    defender * Math.sqrt(defenceWeight / attackMultiplier),
    pacedLosses * 1.05,
  );
  const win = commit > required;
  const survivors = !win
    ? 0
    : paced
      ? Math.max(0, commit - pacedLosses)
      : lanchesterSurvivors;
  const duration = paced ? floorLength : Math.min(lanchesterDuration, floorLength);

  return { defender, required, win, survivors, duration };
}

export function canAttack(state: GameState, targetId: string): boolean {
  if (state.battle && state.battle.outcome === 'ongoing') return false;
  if (targetId in state.owned) return false;
  return frontierOf(state).includes(targetId);
}

export function declareWar(
  state: GameState,
  targetId: string,
  commit: number,
): boolean {
  if (!canAttack(state, targetId)) return false;
  // Only troops not pinned down policing the empire can march.
  const force = Math.min(derive(state).deployable, Math.max(0, commit));
  if (force <= 0) return false;

  const defender = enemyArmy(state, targetId);
  state.army -= force;
  state.battle = {
    targetId,
    targetName: countryName(targetId),
    attacker: force,
    attackerStart: force,
    defender,
    defenderStart: defender,
    elapsed: 0,
    length: campaignLength(targetId),
    outcome: 'ongoing',
    samples: [{ t: 0, attacker: force, defender }],
  };
  pushLog(
    state,
    'war',
    `War declared on ${countryName(targetId)} — ${fmtShort(force)} committed against ${fmtShort(defender)}.`,
  );
  return true;
}

/** Pull the surviving attackers home and leave the enemy bloodied. */
export function retreat(state: GameState): void {
  const b = state.battle;
  if (!b || b.outcome !== 'ongoing') return;
  b.outcome = 'retreat';
  state.army += b.attacker;
  state.damaged[b.targetId] = b.defender;
  pushLog(
    state,
    'war',
    `Withdrawal from ${b.targetName}. ${fmtShort(b.attacker)} brought home.`,
  );
}

function conquer(state: GameState, targetId: string): void {
  state.owned[targetId] = CONQUEST_SHARE;
  delete state.damaged[targetId];
  state.battlesWon += 1;
  pushLog(
    state,
    'war',
    `${countryName(targetId)} annexed. Its territory answers to you at ${fmtPercent(
      CONQUEST_SHARE,
    )} and rising.`,
  );
}

/** Advance an ongoing battle. Returns the outcome if it ended this call. */
function advanceBattle(state: GameState, dt: number): void {
  const b = state.battle;
  if (!b || b.outcome !== 'ongoing') return;

  const { effects, attackMultiplier } = derive(state);
  const lossFactor = Math.max(0.15, 1 - effects.lossRed);

  let remaining = Math.min(dt, 5);
  while (remaining > 0 && b.outcome === 'ongoing') {
    const step = Math.min(COMBAT_STEP, remaining);
    remaining -= step;
    b.elapsed += step;

    const attackPower = b.attacker * attackMultiplier;
    const defencePower = b.defender * DEFENDER_BONUS;
    const noise = () => 0.85 + Math.random() * 0.3;

    b.attacker -= COMBAT_K * defencePower * lossFactor * noise() * step;
    b.defender -= COMBAT_K * attackPower * noise() * step;

    // The defence cannot collapse faster than the campaign can physically
    // advance, so overwhelming force wins on schedule rather than instantly —
    // and pays for the extra days in the field.
    const floor = b.defenderStart * (1 - Math.min(1, b.elapsed / b.length));
    if (b.defender < floor) b.defender = floor;

    if (b.defender <= 0 && b.attacker > 0) {
      b.defender = 0;
      b.outcome = 'won';
    } else if (b.attacker <= 0) {
      b.attacker = 0;
      b.outcome = 'lost';
    }
  }

  // Keep a bounded history for the battle sparkline.
  const last = b.samples[b.samples.length - 1];
  if (b.elapsed - last.t >= 0.1 || b.outcome !== 'ongoing') {
    b.samples.push({
      t: b.elapsed,
      attacker: Math.max(0, b.attacker),
      defender: Math.max(0, b.defender),
    });
    if (b.samples.length > 400) b.samples.shift();
  }

  if (b.outcome === 'won') {
    conquer(state, b.targetId);
    state.army += b.attacker;
  } else if (b.outcome === 'lost') {
    state.battlesLost += 1;
    state.damaged[b.targetId] = Math.max(0.5, b.defender);
    pushLog(
      state,
      'war',
      `The offensive against ${b.targetName} is destroyed. ${fmtShort(
        b.defender,
      )} enemy troops remain.`,
    );
  }
}

/** Advance the whole simulation by `dt` seconds. */
export function tick(state: GameState, dt: number): void {
  if (!state.homeId || dt <= 0) return;
  const d = derive(state);

  state.research += d.researchRate * dt;

  // Mobilised industry becomes soldiers until the manpower ceiling is hit;
  // past that the spending would be wasted, so it falls back to the treasury.
  // Troops already fighting still count against the ceiling — otherwise
  // committing the whole army would free up the cap to raise a second one.
  const inTheField =
    state.battle?.outcome === 'ongoing' ? state.battle.attacker : 0;
  const headroom = Math.max(0, d.armyCap - state.army - inTheField);
  const recruited = Math.min(headroom, d.recruitRate * dt);
  state.army += recruited;
  const unusedRecruitIndustry =
    d.conversion > 0 ? (d.recruitRate * dt - recruited) / d.conversion : 0;
  state.industry += d.treasuryRate * dt + unusedRecruitIndustry;

  state.popMultiplier *= 1 + BASE_POP_GROWTH * (1 + d.effects.popMult) * dt;

  const assimilation = BASE_ASSIMILATION * (1 + d.effects.assimMult) * dt;
  for (const [id, integration] of Object.entries(state.owned)) {
    if (integration < 1) {
      state.owned[id] = Math.min(1, integration + assimilation);
    }
  }

  advanceBattle(state, dt);
  state.lastTick = Date.now();
}

/**
 * Catch the simulation up after the tab was closed. Battles are left frozen —
 * you should be watching those.
 */
export function applyOffline(state: GameState): number {
  if (!state.homeId) return 0;
  const seconds = Math.min(
    MAX_OFFLINE_SECONDS,
    Math.max(0, (Date.now() - state.lastTick) / 1000),
  );
  if (seconds < 5) {
    state.lastTick = Date.now();
    return 0;
  }
  const frozen = state.battle;
  state.battle = null;
  // Coarse steps: the economy is smooth enough that 5s granularity is exact
  // for everything except the compounding population term, which barely moves.
  let left = seconds;
  while (left > 0) {
    const step = Math.min(5, left);
    tick(state, step);
    left -= step;
  }
  state.battle = frozen;
  state.lastTick = Date.now();
  return seconds;
}

export function hasWon(state: GameState): boolean {
  return Object.keys(state.owned).length >= TOTAL_COUNTRIES;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Every fractional figure in the UI is shown to this many places. */
const DECIMALS = 2;

/**
 * Compact number formatting. Always two decimal places, so columns of figures
 * line up and nothing jitters between widths as a value grows.
 */
export function fmtShort(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  if (v < 1000) return sign + v.toFixed(DECIMALS);
  let u = 0;
  while (v >= 1000 && u < UNITS.length - 1) {
    v /= 1000;
    u += 1;
  }
  return `${sign}${v.toFixed(DECIMALS)}${UNITS[u]}`;
}

/** A 0..1 fraction as a percentage, to the same two places. */
export function fmtPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(DECIMALS)}%`;
}

/** A whole count — territories, buildings, battles won. Never fractional. */
export function fmtCount(n: number): string {
  return Math.round(n).toLocaleString();
}

export function fmtRate(n: number): string {
  return `${fmtShort(n)}/s`;
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Seconds until `target` is affordable at the current rate, or Infinity. */
export function timeTo(current: number, target: number, rate: number): number {
  if (current >= target) return 0;
  if (rate <= 0) return Infinity;
  return (target - current) / rate;
}

export const ALL_BUILDINGS = BUILDINGS;

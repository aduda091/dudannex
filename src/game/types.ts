export interface WorldCountry {
  id: string;
  name: string;
  /** Lowercase ISO 3166-1 alpha-2, or null for states without one. */
  iso2: string | null;
  /** Pre-projected SVG path data. */
  d: string;
  cx: number;
  cy: number;
  neighbors: string[];
}

export interface WorldData {
  width: number;
  height: number;
  countries: WorldCountry[];
}

/** Every modifier buildings and technologies can move. All are additive. */
export interface Effects {
  /** Flat industry per second. */
  prodFlat: number;
  /** Fractional bonus to total industry output. */
  prodMult: number;
  /** Flat research per second. */
  resFlat: number;
  /** Fractional bonus to total research output. */
  resMult: number;
  /** Flat additions to the standing-army cap. */
  manpowerFlat: number;
  /** Fractional bonus to the standing-army cap. */
  manpowerMult: number;
  /** Fractional bonus to army strength when attacking. */
  effMult: number;
  /** Fractional bonus to how much army each industry point buys. */
  convMult: number;
  /** Fractional bonus to population growth. */
  popMult: number;
  /** Fractional bonus to how fast conquests integrate. */
  assimMult: number;
  /** Fractional discount on building costs (capped when applied). */
  costRed: number;
  /** Fractional reduction of your own casualties in battle. */
  lossRed: number;
  /** Fractional reduction in the troops tied down policing occupied land. */
  garrisonRed: number;
  /** Extra simultaneous offensives you can run, on top of the base one. */
  fronts: number;
  /** Fractional reduction in how long a campaign takes to cover its ground. */
  campaignSpeed: number;
}

export type EffectKey = keyof Effects;

export type Category = 'industry' | 'science' | 'military' | 'civic';

export interface BuildingDef {
  id: string;
  name: string;
  blurb: string;
  category: Category;
  /** Cost of the first copy, in industry points. */
  baseCost: number;
  /** Cost multiplier per copy already owned. */
  growth: number;
  /** Technology that must be researched before this can be built. */
  requires?: string;
  effects: Partial<Effects>;
}

export interface TechDef {
  id: string;
  name: string;
  blurb: string;
  category: Category;
  cost: number;
  /** Technologies that must be researched first. */
  requires: string[];
  effects: Partial<Effects>;
  /** Buildings this technology puts on the menu. */
  unlocks?: string[];
}

export interface BattleTickSample {
  t: number;
  attacker: number;
  defender: number;
}

export interface Battle {
  targetId: string;
  targetName: string;
  /** Army committed by the player, decreasing as the fight goes on. */
  attacker: number;
  /** What the player started the battle with — for the summary. */
  attackerStart: number;
  defender: number;
  defenderStart: number;
  /** Seconds of fighting so far. */
  elapsed: number;
  /** Seconds the campaign needs to cover the ground, regardless of the odds. */
  length: number;
  outcome: 'ongoing' | 'won' | 'lost' | 'retreat';
  /** Sparkline history of both sides. */
  samples: BattleTickSample[];
}

export interface LogEntry {
  t: number;
  kind: 'war' | 'build' | 'tech' | 'system';
  text: string;
}

export interface GameState {
  version: number;
  /** Country the player started as. Null until the game begins. */
  homeId: string | null;
  /**
   * Owned territory. Maps country id to its integration level (0..1): how much
   * of its economy and manpower actually answers to you. The homeland sits at
   * 1; conquests start at 0.5 and climb.
   */
  owned: Record<string, number>;
  industry: number;
  research: number;
  army: number;
  /** Compounding population growth applied on top of the baseline figures. */
  popMultiplier: number;
  buildings: Record<string, number>;
  techs: string[];
  /** Share of industry income diverted into recruitment, 0..1. */
  mobilization: number;
  /** Offensives currently running. Length is capped by the `fronts` effect. */
  battles: Battle[];
  /** Armies of countries the player has fought but not yet conquered. */
  damaged: Record<string, number>;
  /**
   * The `worldArmament` reading when each damaged country was last fought, so
   * its rearmament resumes from that point rather than from the start.
   */
  damagedAt: Record<string, number>;
  /**
   * How far the rest of the world has rearmed, in units of accumulated
   * production. Every unowned country's army grows by its own production times
   * this figure, so a large economy rearms faster than a small one.
   */
  worldArmament: number;
  lastTick: number;
  startedAt: number;
  battlesWon: number;
  battlesLost: number;
  log: LogEntry[];
  /**
   * Simulation speed multiplier. 1 is normal; a speedrun runs at 10. Chosen
   * when the game starts and kept for the run.
   */
  speed: number;
  /**
   * Set once the player has seen the victory screen, so winning does not
   * re-trap them behind the same dialog on every reload.
   */
  victorySeen: boolean;
}

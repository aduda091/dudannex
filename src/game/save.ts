import { createInitialState } from './engine';
import type { GameState } from './types';

const STORAGE_KEY = 'dudannex.save.v1';
const MAGIC = 'dudannex-save';
const FORMAT = 1;

/**
 * The game was called Cartographer before it was called Dudannex. Saves written
 * under the old name are still read, so nobody loses a game to a rename.
 * Anything loaded this way is rewritten under the new key on the next autosave.
 * Safe to delete once no old saves are left in the wild.
 */
const LEGACY_STORAGE_KEY = 'cartographer.save.v1';
const LEGACY_MAGIC = 'cartographer-save';

interface SaveEnvelope {
  /** Always written as MAGIC; reads also accept LEGACY_MAGIC. */
  game: string;
  format: number;
  saved: string;
  state: GameState;
}

/** Strip the parts of the state that are big and not worth persisting. */
function slim(state: GameState): GameState {
  return {
    ...state,
    log: state.log.slice(0, 30),
    battle: state.battle
      ? { ...state.battle, samples: state.battle.samples.slice(-40) }
      : null,
  };
}

function envelope(state: GameState): SaveEnvelope {
  return {
    game: MAGIC,
    format: FORMAT,
    saved: new Date().toISOString(),
    state: slim(state),
  };
}

export function saveLocal(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope(state)));
  } catch {
    // Quota or private-mode failures are not worth interrupting play for.
  }
}

export function loadLocal(): GameState | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    return parseSave(raw);
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing useful to do.
  }
}

/** Pretty JSON, meant to be selected, copied and pasted into a text file. */
export function exportSave(state: GameState): string {
  return JSON.stringify(envelope(state), null, 1);
}

/**
 * Read a save produced by `exportSave`. Throws with a readable message so the
 * import dialog can show it verbatim.
 */
export function parseSave(text: string): GameState {
  let data: unknown;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error('That is not valid JSON — check the paste is complete.');
  }
  if (!data || typeof data !== 'object') throw new Error('Save file is empty.');

  const env = data as Partial<SaveEnvelope>;
  if (env.game !== MAGIC && env.game !== LEGACY_MAGIC) {
    throw new Error('This JSON is not a Dudannex save.');
  }
  if (typeof env.format !== 'number' || env.format > FORMAT) {
    throw new Error(
      `Save format ${String(env.format)} is newer than this build understands.`,
    );
  }
  if (!env.state || typeof env.state !== 'object') {
    throw new Error('Save is missing its game state.');
  }

  // Merge over a fresh state so that saves written by older builds still load
  // once new fields are added.
  const merged: GameState = { ...createInitialState(), ...env.state };
  if (typeof merged.homeId !== 'string' || !merged.owned || typeof merged.owned !== 'object') {
    throw new Error('Save is missing the country you were playing.');
  }
  merged.log ??= [];
  merged.damaged ??= {};
  merged.buildings ??= {};
  merged.techs ??= [];
  // `lastTick` is deliberately preserved: it is what offline catch-up measures
  // against on load. Only fall back to now if it is missing or nonsensical
  // (a clock skew far in the future would otherwise freeze the simulation).
  if (
    typeof merged.lastTick !== 'number' ||
    !Number.isFinite(merged.lastTick) ||
    merged.lastTick > Date.now()
  ) {
    merged.lastTick = Date.now();
  }
  return merged;
}

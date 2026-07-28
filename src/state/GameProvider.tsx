import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as engine from '../game/engine';
import { applyOffline, createInitialState, derive, tick } from '../game/engine';
import { clearLocal, exportSave, loadLocal, parseSave, saveLocal } from '../game/save';
import type { Derived } from '../game/engine';
import type { GameState } from '../game/types';

/** Simulation step, in milliseconds. Fast enough for smooth battle bars. */
const TICK_MS = 100;
const AUTOSAVE_MS = 5000;

export interface GameApi {
  state: GameState;
  derived: Derived;
  /** Seconds of progress granted on load, if any. Cleared once acknowledged. */
  offlineGain: number | null;
  acknowledgeOffline: () => void;
  /**
   * Whether the war room is on screen. It has to be dismissible even while
   * fighting, otherwise the dialog blocks the very panel you open new fronts
   * from. Declaring a war brings it back.
   */
  warRoomOpen: boolean;
  setWarRoomOpen: (open: boolean) => void;
  start: (countryId: string) => void;
  build: (buildingId: string) => void;
  research: (techId: string) => void;
  declareWar: (targetId: string, commit: number) => void;
  retreat: (targetId: string) => void;
  /** Clear every concluded front from the war room. */
  dismissBattles: () => void;
  setMobilization: (value: number) => void;
  exportText: () => string;
  importText: (text: string) => void;
  reset: () => void;
}

const GameContext = createContext<GameApi | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<GameState>(null!);
  const [, setFrame] = useState(0);
  const [offlineGain, setOfflineGain] = useState<number | null>(null);
  const [warRoomOpen, setWarRoomOpen] = useState(true);

  // Load once, before the first paint, so the UI never flashes an empty world.
  if (stateRef.current === null) {
    const loaded = loadLocal();
    stateRef.current = loaded ?? createInitialState();
  }

  const invalidate = useCallback(() => setFrame((f) => f + 1), []);

  useEffect(() => {
    const gained = applyOffline(stateRef.current);
    if (gained > 0) setOfflineGain(gained);
    invalidate();
    // Intentionally once per mount: this is the "welcome back" catch-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = window.setInterval(() => {
      tick(stateRef.current, TICK_MS / 1000);
      invalidate();
    }, TICK_MS);
    return () => window.clearInterval(handle);
  }, [invalidate]);

  useEffect(() => {
    const handle = window.setInterval(() => saveLocal(stateRef.current), AUTOSAVE_MS);
    const onHide = () => saveLocal(stateRef.current);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(handle);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
      saveLocal(stateRef.current);
    };
  }, []);

  const mutate = useCallback(
    (fn: (s: GameState) => void) => {
      fn(stateRef.current);
      invalidate();
    },
    [invalidate],
  );

  const state = stateRef.current;
  const derived = derive(state);

  const api = useMemo<GameApi>(
    () => ({
      state: stateRef.current,
      derived,
      offlineGain,
      acknowledgeOffline: () => setOfflineGain(null),
      start: (id) =>
        mutate((s) => {
          engine.startGame(s, id);
          saveLocal(s);
        }),
      build: (id) => mutate((s) => engine.build(s, id)),
      research: (id) => mutate((s) => engine.research(s, id)),
      warRoomOpen,
      setWarRoomOpen,
      declareWar: (id, commit) =>
        mutate((s) => {
          if (engine.declareWar(s, id, commit)) setWarRoomOpen(true);
        }),
      retreat: (targetId) => mutate((s) => engine.retreat(s, targetId)),
      dismissBattles: () =>
        mutate((s) => {
          s.battles = s.battles.filter((b) => b.outcome === 'ongoing');
        }),
      setMobilization: (v) =>
        mutate((s) => {
          s.mobilization = Math.min(1, Math.max(0, v));
        }),
      exportText: () => exportSave(stateRef.current),
      importText: (text) => {
        const next = parseSave(text);
        stateRef.current = next;
        saveLocal(next);
        setOfflineGain(null);
        invalidate();
      },
      reset: () => {
        clearLocal();
        stateRef.current = createInitialState();
        setOfflineGain(null);
        invalidate();
      },
    }),
    // `derived` and the state ref change every frame; the rest are stable.
    [derived, offlineGain, warRoomOpen, mutate, invalidate],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { dayKey } from '../utils/dates.js';

export const DEFAULT_SETTINGS = { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4 };
const MIN_LOGGABLE_MS = 60 * 1000;

export const PHASE_LABEL = { focus: 'Concentración', break: 'Descanso', longBreak: 'Descanso largo' };

export const phaseDurationMs = (phase, settings) => {
  const minutes = { focus: settings.focusMinutes, break: settings.breakMinutes, longBreak: settings.longBreakMinutes }[phase];
  return minutes * 60 * 1000;
};

function idleState(phase, settings, completedFocus) {
  return {
    phase,
    status: 'idle',
    endsAt: null,
    remainingMs: phaseDurationMs(phase, settings),
    phaseStartedAt: null,
    elapsedMs: 0,
    runStartedAt: null,
    completedFocus,
  };
}

// Sesión lista para registrar en la API (o null si fue demasiado corta).
function sessionRecord(state, now, completed) {
  const activeMs = state.elapsedMs + (state.runStartedAt ? now - state.runStartedAt : 0);
  if (!state.phaseStartedAt || (!completed && activeMs < MIN_LOGGABLE_MS)) return null;

  const plannedMs = phaseDurationMs(state.phase, state.settings);
  return {
    day: dayKey(new Date(state.phaseStartedAt)),
    phase: state.phase === 'focus' ? 'focus' : 'break',
    plannedSeconds: Math.round(plannedMs / 1000),
    actualSeconds: Math.round(Math.min(completed ? plannedMs : activeMs, plannedMs) / 1000),
    completed,
    startedAt: new Date(state.phaseStartedAt).toISOString(),
    endedAt: new Date(completed && state.endsAt ? Math.min(state.endsAt, now) : now).toISOString(),
    subjectId: state.subjectId ?? null,
  };
}

function nextPhase(state, focusFinished) {
  if (state.phase !== 'focus') {
    // Tras el descanso largo empieza un ciclo nuevo.
    return { phase: 'focus', completedFocus: state.phase === 'longBreak' ? 0 : state.completedFocus };
  }
  const completedFocus = state.completedFocus + (focusFinished ? 1 : 0);
  const longBreak = completedFocus > 0 && completedFocus % state.settings.cyclesBeforeLongBreak === 0;
  return { phase: longBreak ? 'longBreak' : 'break', completedFocus };
}

// El temporizador vive aquí (y en localStorage) para seguir en marcha al cambiar de página o recargar.
// Se basa en marcas de tiempo, no en contar segundos, así que no deriva.
export const usePomodoroStore = create(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      subjectId: null,
      ...idleState('focus', DEFAULT_SETTINGS, 0),

      syncSettings: (settings) => {
        const state = get();
        set({ settings, ...(state.status === 'idle' ? { remainingMs: phaseDurationMs(state.phase, settings) } : {}) });
      },

      setSubject: (subjectId) => set({ subjectId }),

      start: () => {
        const state = get();
        if (state.status === 'running') return;
        const now = Date.now();
        set({
          status: 'running',
          runStartedAt: now,
          endsAt: now + state.remainingMs,
          phaseStartedAt: state.phaseStartedAt ?? now,
        });
      },

      pause: () => {
        const state = get();
        if (state.status !== 'running') return;
        const now = Date.now();
        set({
          status: 'paused',
          elapsedMs: state.elapsedMs + (now - state.runStartedAt),
          remainingMs: Math.max(0, state.endsAt - now),
          runStartedAt: null,
          endsAt: null,
        });
      },

      // Vuelve a empezar la fase actual sin registrarla.
      reset: () => {
        const state = get();
        set(idleState(state.phase, state.settings, state.completedFocus));
      },

      // Termina la sesión de estudio: registra lo hecho y vuelve al primer ciclo.
      stop: () => {
        const state = get();
        const record = sessionRecord(state, Date.now(), false);
        set(idleState('focus', state.settings, 0));
        return record;
      },

      // Pasa a la siguiente fase sin esperar al final.
      skip: () => {
        const state = get();
        const record = sessionRecord(state, Date.now(), false);
        const next = nextPhase(state, false);
        set(idleState(next.phase, state.settings, next.completedFocus));
        return record;
      },

      // La llama el motor cuando el tiempo llega a cero.
      complete: () => {
        const state = get();
        const record = sessionRecord(state, Date.now(), true);
        const next = nextPhase(state, true);
        set(idleState(next.phase, state.settings, next.completedFocus));
        return { record, finishedPhase: state.phase, nextPhase: next.phase };
      },

      // Al cerrar sesión: el temporizador no debe pasar a otra cuenta en el mismo navegador.
      clear: () => set({ settings: DEFAULT_SETTINGS, subjectId: null, ...idleState('focus', DEFAULT_SETTINGS, 0) }),
    }),
    {
      name: 'sp-pomodoro',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => Object.fromEntries(Object.entries(state).filter(([, value]) => typeof value !== 'function')),
    },
  ),
);

export function remainingMsAt(state, now = Date.now()) {
  return state.status === 'running' ? Math.max(0, state.endsAt - now) : state.remainingMs;
}

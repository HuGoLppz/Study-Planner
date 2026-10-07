import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { pomodoroApi } from '../services/api.js';
import { PHASE_LABEL, remainingMsAt, usePomodoroStore } from '../store/pomodoroStore.js';
import { getErrorMessage } from '../utils/errors.js';
import { qk } from './queryKeys.js';
import { pageTitle } from './useUi.js';

export function usePomodoroSettings() {
  const syncSettings = usePomodoroStore((state) => state.syncSettings);
  const query = useQuery({ queryKey: qk.pomodoro.settings, queryFn: pomodoroApi.settings, staleTime: Infinity });

  useEffect(() => {
    if (query.data) syncSettings(query.data);
  }, [query.data, syncSettings]);
  return query;
}

export function useUpdatePomodoroSettings() {
  const queryClient = useQueryClient();
  const syncSettings = usePomodoroStore((state) => state.syncSettings);
  return useMutation({
    mutationFn: pomodoroApi.updateSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(qk.pomodoro.settings, settings);
      syncSettings(settings);
      toast.success('Tiempos guardados');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function usePomodoroDay(day) {
  return useQuery({ queryKey: qk.pomodoro.day(day), queryFn: () => pomodoroApi.day(day) });
}

export function usePomodoroHistory(from, to) {
  return useQuery({ queryKey: qk.pomodoro.history(from, to), queryFn: () => pomodoroApi.history(from, to) });
}

export function useLogPomodoroSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pomodoroApi.logSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.pomodoro.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'No se ha podido guardar la sesión')),
  });
}

// Aviso sonoro breve con Web Audio (sin archivos externos).
function chime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    [0, 0.18].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = index === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.55);
    });
    setTimeout(() => context.close(), 1200);
  } catch {
    // Sin audio disponible: el aviso visual es suficiente.
  }
}

const formatClock = (ms) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// Motor global: detecta el final de cada fase, la registra y actualiza el título de la pestaña.
export function usePomodoroEngine(enabled) {
  const status = usePomodoroStore((state) => state.status);
  const { mutate: logSession } = useLogPomodoroSession();
  usePomodoroSettings();

  useEffect(() => {
    if (!enabled || status !== 'running') return undefined;

    const tick = () => {
      const state = usePomodoroStore.getState();
      if (state.status !== 'running') return;
      const remaining = remainingMsAt(state);

      if (remaining <= 0) {
        const { record, finishedPhase, nextPhase } = state.complete();
        if (record) logSession(record);
        chime();
        toast.success(
          finishedPhase === 'focus' ? 'Bloque de concentración terminado' : 'Descanso terminado',
          { description: `Siguiente: ${PHASE_LABEL[nextPhase].toLowerCase()}` },
        );
        return;
      }
      document.title = `${formatClock(remaining)} ${PHASE_LABEL[state.phase]}`;
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => {
      clearInterval(interval);
      document.title = pageTitle.current;
    };
  }, [enabled, status, logSession]);
}

export { formatClock };

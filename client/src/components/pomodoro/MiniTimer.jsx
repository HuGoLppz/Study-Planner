import { Pause, Play } from "@phosphor-icons/react";
import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import { formatClock } from "../../hooks/usePomodoro.js";
import { useNow } from "../../hooks/useUi.js";
import {
  PHASE_LABEL,
  remainingMsAt,
  usePomodoroStore,
} from "../../store/pomodoroStore.js";

// Temporizador en curso visible en cualquier página (rail en escritorio, píldora en móvil).
export function MiniTimer({ compact = false, floating = false }) {
  const status = usePomodoroStore((state) => state.status);
  const phase = usePomodoroStore((state) => state.phase);
  const endsAt = usePomodoroStore((state) => state.endsAt);
  const remainingMs = usePomodoroStore((state) => state.remainingMs);
  const start = usePomodoroStore((state) => state.start);
  const pause = usePomodoroStore((state) => state.pause);
  const { pathname } = useLocation();
  useNow(status === "running" ? 1000 : 60 * 60 * 1000);

  // En la propia página del Pomodoro ya está el temporizador grande.
  if (status === "idle" || pathname === "/pomodoro") return null;

  const running = status === "running";
  const clock = formatClock(remainingMsAt({ status, endsAt, remainingMs }));

  return (
    <div
      className={clsx(
        "mini-timer-timer",
        compact && "mini-timer-compact",
        floating && "mini-timer-floating",
        phase !== "focus" && "mini-timer-resting",
      )}
    >
      <Link
        to="/pomodoro"
        className="mini-timer-link"
        aria-label={`${PHASE_LABEL[phase]}: quedan ${clock}`}
      >
        <span className="mini-timer-clock">{clock}</span>
        {!compact ? (
          <span className="mini-timer-phase">
            {running ? PHASE_LABEL[phase] : "En pausa"}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        className="mini-timer-toggle"
        onClick={running ? pause : start}
        aria-label={running ? "Pausar" : "Reanudar"}
      >
        {running ? (
          <Pause size={16} weight="fill" aria-hidden />
        ) : (
          <Play size={16} weight="fill" aria-hidden />
        )}
      </button>
    </div>
  );
}

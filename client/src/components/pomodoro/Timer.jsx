import {
  ArrowCounterClockwise,
  Pause,
  Play,
  SkipForward,
  Stop,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { formatClock, useLogPomodoroSession } from "../../hooks/usePomodoro.js";
import { useSubjects } from "../../hooks/useSubjects.js";
import { useNow } from "../../hooks/useUi.js";
import {
  PHASE_LABEL,
  phaseDurationMs,
  remainingMsAt,
  usePomodoroStore,
} from "../../store/pomodoroStore.js";
import { Button } from "../ui/Button.jsx";
import { Field, Select } from "../ui/Form.jsx";

// Ciclo actual: un trazo por bloque de concentración hasta el descanso largo.
function CycleTrack({ completed, total, phase }) {
  const position = completed % total || (phase === "longBreak" ? total : 0);
  return (
    <div className="pomodoro-cycle">
      <ol className="pomodoro-cycle-marks" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <li
            key={index}
            className={clsx(
              "pomodoro-cycle-mark",
              index < position && "pomodoro-cycle-done",
              index === position &&
                phase === "focus" &&
                "pomodoro-cycle-current",
            )}
          />
        ))}
      </ol>
      <p className="pomodoro-cycle-text">
        {phase === "longBreak"
          ? "Ciclo completo: toca un descanso largo."
          : `Bloque ${Math.min(position + (phase === "focus" ? 1 : 0), total)} de ${total} antes del descanso largo`}
      </p>
    </div>
  );
}

export function Timer() {
  const state = usePomodoroStore();
  const { subjects } = useSubjects();
  const log = useLogPomodoroSession();
  useNow(state.status === "running" ? 250 : 60 * 1000);

  const remaining = remainingMsAt(state);
  const total = phaseDurationMs(state.phase, state.settings);
  const progress = Math.min(1, Math.max(0, 1 - remaining / total));
  const resting = state.phase !== "focus";
  const started = state.status !== "idle" || state.phaseStartedAt != null;

  const record = (session) => {
    if (session) log.mutate(session);
  };

  const statusText =
    state.status === "running"
      ? resting
        ? "Descansando"
        : "Concentrándote"
      : state.status === "paused"
        ? "En pausa"
        : "Preparado";

  return (
    <section
      className={clsx("pomodoro-timer", resting && "pomodoro-resting")}
      aria-label="Temporizador Pomodoro"
    >
      <div className="pomodoro-phase-row">
        <span className="pomodoro-phase">{PHASE_LABEL[state.phase]}</span>
        <span className="pomodoro-status">
          <span
            className={clsx(
              "pomodoro-status-dot",
              state.status === "running" && "pomodoro-status-live",
            )}
            aria-hidden
          />
          {statusText}
        </span>
      </div>

      <p
        className="pomodoro-clock"
        role="timer"
        aria-live="off"
        aria-label={`Quedan ${formatClock(remaining)}`}
      >
        {formatClock(remaining)}
      </p>

      <div
        className="pomodoro-progress"
        role="progressbar"
        aria-label="Avance de la fase"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className="pomodoro-controls">
        {state.status === "running" ? (
          <Button
            size="lg"
            icon={Pause}
            onClick={state.pause}
            className="pomodoro-main-control"
          >
            Pausar
          </Button>
        ) : (
          <Button
            size="lg"
            icon={Play}
            onClick={state.start}
            className="pomodoro-main-control"
          >
            {state.status === "paused"
              ? "Reanudar"
              : resting
                ? "Empezar descanso"
                : "Empezar"}
          </Button>
        )}
        <Button
          size="lg"
          variant="secondary"
          icon={ArrowCounterClockwise}
          onClick={state.reset}
          disabled={!started}
          className="pomodoro-sub-control"
        >
          Reiniciar
        </Button>
        <Button
          size="lg"
          variant="secondary"
          icon={SkipForward}
          onClick={() => record(state.skip())}
          className="pomodoro-sub-control"
        >
          Saltar
        </Button>
        <Button
          size="lg"
          variant="ghost"
          icon={Stop}
          onClick={() => record(state.stop())}
          disabled={!started && state.completedFocus === 0}
          className="pomodoro-sub-control"
        >
          Detener
        </Button>
      </div>

      <CycleTrack
        completed={state.completedFocus}
        total={state.settings.cyclesBeforeLongBreak}
        phase={state.phase}
      />

      <Field label="Estás estudiando" className="pomodoro-subject">
        <Select
          value={state.subjectId ?? ""}
          onChange={(event) => state.setSubject(event.target.value || null)}
        >
          <option value="">Sin asignatura concreta</option>
          {subjects.map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </Field>
    </section>
  );
}

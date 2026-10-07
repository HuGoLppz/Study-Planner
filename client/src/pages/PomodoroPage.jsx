import { zodResolver } from '@hookform/resolvers/zod';
import { addDays } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ColumnChart } from '../components/charts/ColumnChart.jsx';
import styles from '../components/pomodoro/Pomodoro.module.css';
import { Timer } from '../components/pomodoro/Timer.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Skeleton } from '../components/ui/Feedback.jsx';
import { Field, Input } from '../components/ui/Form.jsx';
import { Page, PageHeader, Section } from '../components/ui/Page.jsx';
import { usePomodoroDay, usePomodoroHistory, usePomodoroSettings, useUpdatePomodoroSettings } from '../hooks/usePomodoro.js';
import { useSubjects } from '../hooks/useSubjects.js';
import { useNow } from '../hooks/useUi.js';
import { capitalize, dayKey, fmt, formatLongDate, formatTime } from '../utils/dates.js';
import { formatMinutes, plural } from '../utils/format.js';

const minutes = (max) => z.coerce.number({ invalid_type_error: 'Escribe un número' }).int('Sin decimales').min(1, 'Mínimo 1').max(max, `Máximo ${max}`);
const schema = z.object({
  focusMinutes: minutes(120),
  breakMinutes: minutes(60),
  longBreakMinutes: minutes(90),
  cyclesBeforeLongBreak: minutes(12),
});

function WallClock() {
  const now = useNow(1000);
  return (
    <div className={styles.wallClock} aria-label={`Son las ${formatTime(now)}`}>
      <span className={styles.wallTime}>
        {formatTime(now)}
        <span className={styles.wallSeconds}>{fmt(now, 'ss')}</span>
      </span>
      <span className={styles.wallDate}>{formatLongDate(now)}</span>
    </div>
  );
}

function SettingsForm() {
  const settings = usePomodoroSettings();
  const save = useUpdatePomodoroSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settings.data) reset(settings.data);
  }, [settings.data, reset]);

  if (settings.isPending) return <Skeleton height={160} />;

  return (
    <form className={styles.settings} onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
      <Field label="Concentración (min)" error={errors.focusMinutes?.message}>
        <Input type="number" inputMode="numeric" min={1} max={120} {...register('focusMinutes')} />
      </Field>
      <Field label="Descanso (min)" error={errors.breakMinutes?.message}>
        <Input type="number" inputMode="numeric" min={1} max={60} {...register('breakMinutes')} />
      </Field>
      <Field label="Descanso largo (min)" error={errors.longBreakMinutes?.message}>
        <Input type="number" inputMode="numeric" min={1} max={90} {...register('longBreakMinutes')} />
      </Field>
      <Field label="Bloques por ciclo" error={errors.cyclesBeforeLongBreak?.message}>
        <Input type="number" inputMode="numeric" min={1} max={12} {...register('cyclesBeforeLongBreak')} />
      </Field>
      <Button type="submit" variant="secondary" disabled={!isDirty} loading={save.isPending} className={styles.settingsSave}>
        Guardar tiempos
      </Button>
    </form>
  );
}

function TodaySessions() {
  const today = useNow(60 * 1000);
  const day = usePomodoroDay(dayKey(today));
  const { get } = useSubjects();
  if (day.isPending) return <Skeleton height={80} />;
  const { totals, sessions } = day.data;
  const focus = sessions.filter((session) => session.phase === 'focus');

  return (
    <>
      <p className={styles.todayLine}>
        {totals.focusSeconds > 0
          ? `${formatMinutes(totals.focusSeconds)} de concentración y ${plural(totals.completedFocus, 'bloque completo', 'bloques completos')}.`
          : 'Aún no has registrado ningún bloque hoy.'}
      </p>
      {focus.length ? (
        <ol className={styles.sessions}>
          {[...focus].reverse().map((session) => (
            <li key={session.startedAt} className={styles.session}>
              <span className="tabular">
                {formatTime(session.startedAt)}–{formatTime(session.endedAt)}
              </span>
              <span>{get(session.subject)?.name ?? 'Estudio'}</span>
              <span className={styles.sessionState}>{session.completed ? formatMinutes(session.actualSeconds) : `${formatMinutes(session.actualSeconds)}, interrumpido`}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

function WeekHistory() {
  const today = useNow(60 * 60 * 1000);
  const from = dayKey(addDays(today, -6));
  const to = dayKey(today);
  const history = usePomodoroHistory(from, to);

  const data = useMemo(() => {
    const byDay = new Map((history.data ?? []).map((item) => [item.day, item.focusSeconds]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);
      const key = dayKey(date);
      return {
        key,
        value: Math.round((byDay.get(key) ?? 0) / 60),
        label: capitalize(fmt(date, "EEEE d 'de' MMMM")),
        short: index === 6 ? 'hoy' : fmt(date, 'EEEEEE'),
      };
    });
  }, [history.data, today]);

  if (history.isPending) return <Skeleton height={140} />;
  return <ColumnChart data={data} valueLabel="min de concentración" formatValue={(value) => `${value} min`} ariaLabel="Minutos de concentración por día" />;
}

export default function PomodoroPage() {
  return (
    <Page title="Pomodoro">
      <PageHeader title="Pomodoro" lead="Bloques de concentración con descansos. El temporizador sigue en marcha aunque cambies de página." />
      <div className={styles.layout}>
        <Timer />
        <div className={styles.aside}>
          <WallClock />
          <Section title="Hoy" id="pomodoro-today">
            <TodaySessions />
          </Section>
          <Section title="Últimos 7 días" id="pomodoro-week">
            <WeekHistory />
          </Section>
          <Section title="Tiempos" id="pomodoro-settings">
            <SettingsForm />
          </Section>
        </div>
      </div>
    </Page>
  );
}

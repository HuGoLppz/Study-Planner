import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import { endOfDay, isAfter, isSameMonth } from 'date-fns';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AgendaList, DayList } from '../components/calendar/AgendaList.jsx';
import styles from '../components/calendar/Calendar.module.css';
import { MonthDots, WeekStrip } from '../components/calendar/MobileCalendar.jsx';
import { MonthGrid } from '../components/calendar/MonthGrid.jsx';
import { WeekColumns } from '../components/calendar/WeekColumns.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../components/ui/Feedback.jsx';
import { Page, PageHeader } from '../components/ui/Page.jsx';
import { Segmented } from '../components/ui/Tabs.jsx';
import { useRoomAgenda } from '../hooks/useRooms.js';
import { useSubjects } from '../hooks/useSubjects.js';
import { useTasksInRange } from '../hooks/useTasks.js';
import { useIsMobile, useNow } from '../hooks/useUi.js';
import { useUiStore } from '../store/uiStore.js';
import { VIEWS, buildItems, daysBetween, groupByDay, parseDay, rangeFor, shift, titleFor } from '../utils/calendar.js';
import { dayKey } from '../utils/dates.js';

const FROM_PARAM = Object.fromEntries(Object.entries(VIEWS).map(([view, param]) => [param, view]));

export default function CalendarPage() {
  const isMobile = useIsMobile();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const createTask = useUiStore((state) => state.createTask);
  const { get } = useSubjects();

  const requested = FROM_PARAM[params.get('vista')];
  // En móvil solo hay semana y mes; la agenda del día está siempre debajo.
  const view = isMobile ? (requested === 'month' ? 'month' : 'week') : requested ?? 'month';
  const anchor = parseDay(params.get('dia'));
  const { from, to } = rangeFor(view, anchor);

  const tasks = useTasksInRange(from, to);
  const agenda = useRoomAgenda(from, to);
  const items = useMemo(() => buildItems(tasks.data, agenda.data, get, now), [tasks.data, agenda.data, get, now]);
  const byDay = useMemo(() => groupByDay(items), [items]);
  const days = useMemo(() => daysBetween(from, to), [from, to]);

  const update = (patch) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      },
      { replace: true },
    );

  const go = (direction) => update({ dia: dayKey(shift(view, anchor, direction)) });
  // Una tarea creada desde un día vence ese día "sin hora" (23:59).
  const createOn = (day) =>
    createTask({ dueDate: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59).toISOString() });

  // Deslizar en móvil cambia de semana o de mes.
  const touch = useRef(null);
  const swipe = {
    onTouchStart: (event) => {
      touch.current = event.touches[0].clientX;
    },
    onTouchEnd: (event) => {
      if (touch.current == null) return;
      const dx = event.changedTouches[0].clientX - touch.current;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      touch.current = null;
    },
  };

  const loading = tasks.isPending || agenda.isPending;
  const failed = tasks.isError || agenda.isError;
  const stale = tasks.isPlaceholderData || agenda.isPlaceholderData;
  const selectedItems = byDay.get(dayKey(anchor)) ?? [];
  const later = items.filter((item) => isAfter(item.date, endOfDay(anchor)) && !item.done).slice(0, 5);

  return (
    <Page title="Calendario">
      <PageHeader
        title="Calendario"
        actions={
          !isMobile ? (
            <Button icon={Plus} onClick={() => createTask()}>
              Nueva tarea
            </Button>
          ) : null
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <IconButton icon={CaretLeft} label={view === 'week' ? 'Semana anterior' : 'Mes anterior'} variant="secondary" onClick={() => go(-1)} />
          <h2 className={styles.title} aria-live="polite">
            {titleFor(view, anchor)}
          </h2>
          <IconButton icon={CaretRight} label={view === 'week' ? 'Semana siguiente' : 'Mes siguiente'} variant="secondary" onClick={() => go(1)} />
          {!isMobile ? (
            <Button variant="ghost" onClick={() => update({ dia: null })}>
              Hoy
            </Button>
          ) : null}
        </div>
        <div className={styles.nav}>
          <Segmented
            label="Vista del calendario"
            value={view}
            onChange={(value) => update({ vista: VIEWS[value] })}
            options={
              isMobile
                ? [
                    { value: 'week', label: 'Semana' },
                    { value: 'month', label: 'Mes' },
                  ]
                : [
                    { value: 'month', label: 'Mes' },
                    { value: 'week', label: 'Semana' },
                    { value: 'agenda', label: 'Agenda' },
                  ]
            }
          />
          {isMobile ? (
            <Button variant="ghost" size="sm" onClick={() => update({ dia: null })}>
              Hoy
            </Button>
          ) : null}
        </div>
      </div>

      {failed ? (
        <ErrorState
          error={tasks.error ?? agenda.error}
          onRetry={() => {
            tasks.refetch();
            agenda.refetch();
          }}
        />
      ) : loading ? (
        <Skeleton height={isMobile ? 120 : 520} radius={12} />
      ) : (
        <div className={styles.loadingOverlay} data-stale={stale || undefined} {...(isMobile ? swipe : {})}>
          {isMobile ? (
            <>
              {view === 'week' ? (
                <WeekStrip days={days} byDay={byDay} selected={anchor} onSelect={(day) => update({ dia: dayKey(day) })} />
              ) : (
                <MonthDots days={days} anchor={anchor} byDay={byDay} selected={anchor} onSelect={(day) => update({ dia: dayKey(day) })} />
              )}
              <DayList day={anchor} items={selectedItems} onCreate={createOn} />
              {later.length ? (
                <section className={styles.upcoming}>
                  <h3 className="section-title">Después</h3>
                  <AgendaList days={days.filter((day) => isAfter(day, anchor))} byDay={groupByDay(later)} />
                </section>
              ) : null}
            </>
          ) : view === 'month' ? (
            <MonthGrid days={days} anchor={anchor} byDay={byDay} onCreate={createOn} />
          ) : view === 'week' ? (
            <WeekColumns days={days} byDay={byDay} onCreate={createOn} />
          ) : (
            <AgendaList
              days={days.filter((day) => isSameMonth(day, anchor))}
              byDay={byDay}
              emptyText="No tienes nada apuntado este mes."
            />
          )}
        </div>
      )}
    </Page>
  );
}

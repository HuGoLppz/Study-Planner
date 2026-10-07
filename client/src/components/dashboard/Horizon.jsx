import { ChatsCircle } from '@phosphor-icons/react';
import clsx from 'clsx';
import { addDays, isWeekend, startOfDay } from 'date-fns';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HORIZON_DAYS } from '../../hooks/useDashboard.js';
import { useSubjects } from '../../hooks/useSubjects.js';
import { useUiStore } from '../../store/uiStore.js';
import { dayKey, fmt, formatLongDate, formatTime, hasTime } from '../../utils/dates.js';
import { plural } from '../../utils/format.js';
import { isOverdue } from '../../utils/tasks.js';
import { subjectColor } from '../../utils/subjects.js';
import { TaskTypeIcon } from '../tasks/TaskBits.jsx';
import styles from './Horizon.module.css';

const VISIBLE_PER_DAY = 4;

// Las próximas dos semanas como columnas de días. Cada entrega lleva el fluorescente de su asignatura.
export function Horizon({ tasks, events, now }) {
  const { get } = useSubjects();
  const openTask = useUiStore((state) => state.openTask);
  const navigate = useNavigate();

  const days = useMemo(() => {
    const grouped = new Map();
    const push = (key, item) => grouped.set(key, [...(grouped.get(key) ?? []), item]);
    tasks.forEach((task) => push(dayKey(task.dueDate), { kind: 'task', task, date: task.dueDate }));
    events.forEach((event) => push(dayKey(event.date), { kind: 'room', event, date: event.date }));

    const today = startOfDay(now);
    return Array.from({ length: HORIZON_DAYS }, (_, index) => {
      const date = addDays(today, index);
      const items = (grouped.get(dayKey(date)) ?? []).sort((a, b) => new Date(a.date) - new Date(b.date));
      return { date, index, items };
    });
  }, [tasks, events, now]);

  const total = tasks.length;

  return (
    <section className={styles.horizon} aria-labelledby="horizon-title">
      <header className={styles.header}>
        <h2 id="horizon-title" className="section-title">
          Próximas dos semanas
        </h2>
        <span className={styles.count}>{total ? plural(total, 'entrega pendiente', 'entregas pendientes') : 'Nada pendiente'}</span>
      </header>

      <div className={styles.scroller}>
        <ol className={styles.strip}>
          {days.map(({ date, index, items }) => {
            const isToday = index === 0;
            const startsWeek = index > 0 && date.getDay() === 1;
            const extra = items.length - VISIBLE_PER_DAY;
            return (
              <li
                key={index}
                className={clsx(styles.day, isWeekend(date) && styles.weekend, startsWeek && styles.weekStart)}
                aria-label={`${formatLongDate(date)}: ${items.length ? plural(items.length, 'entrega', 'entregas') : 'sin entregas'}`}
              >
                <div className={styles.dayHead}>
                  <span className={styles.weekday}>{isToday ? 'hoy' : fmt(date, 'EEEEEE')}</span>
                  <span className={clsx(styles.date, isToday && clsx('swipe', styles.todayDate))}>{fmt(date, 'd')}</span>
                  {date.getDate() === 1 || isToday ? <span className={styles.month}>{fmt(date, 'MMM')}</span> : null}
                </div>
                <ul className={styles.items}>
                  {items.slice(0, VISIBLE_PER_DAY).map((item) =>
                    item.kind === 'task' ? (
                      <li key={item.task._id}>
                        <button
                          type="button"
                          className={clsx(styles.chip, isOverdue(item.task, now) && styles.chipLate, !item.task.subject && styles.chipPlain)}
                          style={{ '--chip': item.task.subject ? subjectColor(get(item.task.subject)?.color) : undefined }}
                          onClick={() => openTask(item.task._id)}
                          title={`${item.task.title}${hasTime(item.task.dueDate) ? `, ${formatTime(item.task.dueDate)}` : ''}`}
                        >
                          <span className={styles.chipText}>
                            <TaskTypeIcon type={item.task.type} size={13} weight="bold" />
                            {item.task.title}
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={item.event._id}>
                        <button
                          type="button"
                          className={clsx(styles.chip, styles.chipRoom)}
                          onClick={() => navigate(`/salas/${item.event.roomId}`)}
                          title={`${item.event.kind === 'session' ? 'Sesión' : 'Tarea de sala'}: ${item.event.title}`}
                        >
                          <span className={styles.chipText}>
                            <ChatsCircle size={13} weight="bold" aria-hidden />
                            {item.event.title}
                          </span>
                        </button>
                      </li>
                    ),
                  )}
                  {extra > 0 ? (
                    <li>
                      <button type="button" className={styles.more} onClick={() => navigate(`/calendario?dia=${dayKey(date)}`)}>
                        +{extra} más
                      </button>
                    </li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

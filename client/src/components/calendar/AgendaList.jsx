import { CalendarBlank } from '@phosphor-icons/react';
import clsx from 'clsx';
import { isToday } from 'date-fns';
import { dayKey, formatDaySeparator } from '../../utils/dates.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { CalendarRow, useOpenItem } from './CalendarItem.jsx';
import styles from './Calendar.module.css';

// Lista cronológica de los días con algo apuntado.
export function AgendaList({ days, byDay, emptyText = 'No hay nada apuntado en estas fechas.' }) {
  const openItem = useOpenItem();
  const busy = days.filter((day) => byDay.get(dayKey(day))?.length);

  if (busy.length === 0) {
    return <EmptyState icon={CalendarBlank} title="Días libres" compact>{emptyText}</EmptyState>;
  }

  return (
    <div className={styles.agenda}>
      {busy.map((day) => (
        <section key={dayKey(day)} className={styles.agendaDay}>
          <h3 className={clsx(styles.agendaTitle, isToday(day) && styles.agendaToday)}>{formatDaySeparator(day)}</h3>
          <div className={styles.agendaItems}>
            {byDay.get(dayKey(day)).map((item) => (
              <CalendarRow key={item.id} item={item} onOpen={openItem} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// Lista del día seleccionado (móvil).
export function DayList({ day, items, onCreate }) {
  const openItem = useOpenItem();
  return (
    <section className={styles.dayList} aria-live="polite">
      <header className={styles.dayListHead}>
        <h3 className="section-title">{formatDaySeparator(day)}</h3>
        <button type="button" className={styles.dayListAdd} onClick={() => onCreate(day)}>
          Añadir tarea
        </button>
      </header>
      {items.length === 0 ? (
        <p className={styles.dayEmpty}>Nada apuntado para este día.</p>
      ) : (
        <div className={styles.agendaItems}>
          {items.map((item) => (
            <CalendarRow key={item.id} item={item} onOpen={openItem} />
          ))}
        </div>
      )}
    </section>
  );
}

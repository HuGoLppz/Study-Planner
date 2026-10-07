import { Plus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { isToday, isWeekend } from 'date-fns';
import { dayKey, fmt } from '../../utils/dates.js';
import { CalendarChip, useOpenItem } from './CalendarItem.jsx';
import styles from './Calendar.module.css';

export function WeekColumns({ days, byDay, onCreate }) {
  const openItem = useOpenItem();
  return (
    <div className={styles.week}>
      {days.map((day) => {
        const items = byDay.get(dayKey(day)) ?? [];
        return (
          <section key={dayKey(day)} className={clsx(styles.weekDay, isWeekend(day) && styles.weekendCol)} aria-label={fmt(day, "EEEE d 'de' MMMM")}>
            <header className={styles.weekHead}>
              <span className={styles.weekName}>{fmt(day, 'EEEE')}</span>
              <span className={clsx(styles.weekDate, isToday(day) && 'swipe')}>{fmt(day, 'd')}</span>
            </header>
            <div className={styles.weekItems}>
              {items.map((item) => (
                <CalendarChip key={item.id} item={item} showTime onOpen={openItem} />
              ))}
              <button type="button" className={styles.addInDay} onClick={() => onCreate(day)} aria-label={`Añadir tarea el ${fmt(day, "d 'de' MMMM")}`}>
                <Plus size={14} weight="bold" aria-hidden /> Añadir
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

import clsx from 'clsx';
import { isSameDay, isSameMonth, isToday } from 'date-fns';
import { dayKey, fmt } from '../../utils/dates.js';
import { subjectColor } from '../../utils/subjects.js';
import styles from './Calendar.module.css';

function Dots({ items }) {
  if (!items.length) return <span className={styles.dots} />;
  return (
    <span className={styles.dots} aria-hidden>
      {items.slice(0, 3).map((item) => (
        <span
          key={item.id}
          className={clsx(styles.dot, item.kind !== 'task' && styles.dotRoom, item.overdue && styles.dotLate)}
          style={{ '--chip': item.color ? subjectColor(item.color) : undefined }}
        />
      ))}
    </span>
  );
}

// Móvil: tira de 7 días. Se toca un día para ver su lista debajo.
export function WeekStrip({ days, byDay, selected, onSelect }) {
  return (
    <div className={styles.strip} role="listbox" aria-label="Días de la semana">
      {days.map((day) => {
        const items = byDay.get(dayKey(day)) ?? [];
        const active = isSameDay(day, selected);
        return (
          <button
            key={dayKey(day)}
            type="button"
            role="option"
            aria-selected={active}
            className={clsx(styles.stripDay, active && styles.stripActive, isToday(day) && styles.stripToday)}
            onClick={() => onSelect(day)}
            aria-label={`${fmt(day, "EEEE d 'de' MMMM")}, ${items.length} elementos`}
          >
            <span className={styles.stripName}>{fmt(day, 'EEEEE')}</span>
            <span className={styles.stripDate}>{fmt(day, 'd')}</span>
            <Dots items={items} />
          </button>
        );
      })}
    </div>
  );
}

// Móvil: mes compacto con puntos de color en lugar de títulos.
export function MonthDots({ days, anchor, byDay, selected, onSelect }) {
  return (
    <div className={styles.monthDots}>
      <div className={styles.weekdays} aria-hidden>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.dotsGrid} role="listbox" aria-label={fmt(anchor, 'MMMM yyyy')}>
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) ?? [];
          const active = isSameDay(day, selected);
          return (
            <button
              key={dayKey(day)}
              type="button"
              role="option"
              aria-selected={active}
              className={clsx(styles.dotsDay, !isSameMonth(day, anchor) && styles.outside, active && styles.stripActive, isToday(day) && styles.stripToday)}
              onClick={() => onSelect(day)}
              aria-label={`${fmt(day, "d 'de' MMMM")}, ${items.length} elementos`}
            >
              <span className={styles.stripDate}>{fmt(day, 'd')}</span>
              <Dots items={items} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

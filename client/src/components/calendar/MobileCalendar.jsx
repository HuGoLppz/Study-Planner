import clsx from "clsx";
import { isSameDay, isSameMonth, isToday } from "date-fns";
import { dayKey, fmt } from "../../utils/dates.js";
import { subjectColor } from "../../utils/subjects.js";

function Dots({ items }) {
  if (!items.length) return <span className="calendar-dots" />;
  return (
    <span className="calendar-dots" aria-hidden>
      {items.slice(0, 3).map((item) => (
        <span
          key={item.id}
          className={clsx(
            "calendar-dot",
            item.kind !== "task" && "calendar-dot-room",
            item.overdue && "calendar-dot-late",
          )}
          style={{
            "--chip": item.color ? subjectColor(item.color) : undefined,
          }}
        />
      ))}
    </span>
  );
}

// Móvil: tira de 7 días. Se toca un día para ver su lista debajo.
export function WeekStrip({ days, byDay, selected, onSelect }) {
  return (
    <div
      className="calendar-strip"
      role="listbox"
      aria-label="Días de la semana"
    >
      {days.map((day) => {
        const items = byDay.get(dayKey(day)) ?? [];
        const active = isSameDay(day, selected);
        return (
          <button
            key={dayKey(day)}
            type="button"
            role="option"
            aria-selected={active}
            className={clsx(
              "calendar-strip-day",
              active && "calendar-strip-active",
              isToday(day) && "calendar-strip-today",
            )}
            onClick={() => onSelect(day)}
            aria-label={`${fmt(day, "EEEE d 'de' MMMM")}, ${items.length} elementos`}
          >
            <span className="calendar-strip-name">{fmt(day, "EEEEE")}</span>
            <span className="calendar-strip-date">{fmt(day, "d")}</span>
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
    <div className="calendar-month-dots">
      <div className="calendar-weekdays" aria-hidden>
        {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="calendar-dots-grid"
        role="listbox"
        aria-label={fmt(anchor, "MMMM yyyy")}
      >
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) ?? [];
          const active = isSameDay(day, selected);
          return (
            <button
              key={dayKey(day)}
              type="button"
              role="option"
              aria-selected={active}
              className={clsx(
                "calendar-dots-day",
                !isSameMonth(day, anchor) && "calendar-outside",
                active && "calendar-strip-active",
                isToday(day) && "calendar-strip-today",
              )}
              onClick={() => onSelect(day)}
              aria-label={`${fmt(day, "d 'de' MMMM")}, ${items.length} elementos`}
            >
              <span className="calendar-strip-date">{fmt(day, "d")}</span>
              <Dots items={items} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

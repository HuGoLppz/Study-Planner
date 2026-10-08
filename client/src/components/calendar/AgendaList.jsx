import { CalendarBlank } from "@phosphor-icons/react";
import clsx from "clsx";
import { isToday } from "date-fns";
import { dayKey, formatDaySeparator } from "../../utils/dates.js";
import { EmptyState } from "../ui/Feedback.jsx";
import { CalendarRow, useOpenItem } from "./CalendarItem.jsx";

// Lista cronológica de los días con algo apuntado.
export function AgendaList({
  days,
  byDay,
  emptyText = "No hay nada apuntado en estas fechas.",
}) {
  const openItem = useOpenItem();
  const busy = days.filter((day) => byDay.get(dayKey(day))?.length);

  if (busy.length === 0) {
    return (
      <EmptyState icon={CalendarBlank} title="Días libres" compact>
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <div className="calendar-agenda">
      {busy.map((day) => (
        <section key={dayKey(day)}>
          <h3
            className={clsx(
              "calendar-agenda-title",
              isToday(day) && "calendar-agenda-today",
            )}
          >
            {formatDaySeparator(day)}
          </h3>
          <div className="calendar-agenda-items">
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
    <section className="calendar-day-list" aria-live="polite">
      <header className="calendar-day-list-head">
        <h3 className="section-title">{formatDaySeparator(day)}</h3>
        <button
          type="button"
          className="calendar-day-list-add"
          onClick={() => onCreate(day)}
        >
          Añadir tarea
        </button>
      </header>
      {items.length === 0 ? (
        <p className="calendar-day-empty">Nada apuntado para este día.</p>
      ) : (
        <div className="calendar-agenda-items">
          {items.map((item) => (
            <CalendarRow key={item.id} item={item} onOpen={openItem} />
          ))}
        </div>
      )}
    </section>
  );
}

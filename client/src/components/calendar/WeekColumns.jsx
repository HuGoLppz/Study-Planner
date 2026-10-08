import { Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { isToday, isWeekend } from "date-fns";
import { dayKey, fmt } from "../../utils/dates.js";
import { CalendarChip, useOpenItem } from "./CalendarItem.jsx";

export function WeekColumns({ days, byDay, onCreate }) {
  const openItem = useOpenItem();
  return (
    <div className="calendar-week">
      {days.map((day) => {
        const items = byDay.get(dayKey(day)) ?? [];
        return (
          <section
            key={dayKey(day)}
            className={clsx(
              "calendar-week-day",
              isWeekend(day) && "calendar-weekend-col",
            )}
            aria-label={fmt(day, "EEEE d 'de' MMMM")}
          >
            <header className="calendar-week-head">
              <span className="calendar-week-name">{fmt(day, "EEEE")}</span>
              <span
                className={clsx("calendar-week-date", isToday(day) && "swipe")}
              >
                {fmt(day, "d")}
              </span>
            </header>
            <div className="calendar-week-items">
              {items.map((item) => (
                <CalendarChip
                  key={item.id}
                  item={item}
                  showTime
                  onOpen={openItem}
                />
              ))}
              <button
                type="button"
                className="calendar-add-in-day"
                onClick={() => onCreate(day)}
                aria-label={`Añadir tarea el ${fmt(day, "d 'de' MMMM")}`}
              >
                <Plus size={14} weight="bold" aria-hidden /> Añadir
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

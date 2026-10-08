import { Plus } from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { isSameMonth, isToday } from "date-fns";
import { dayKey, fmt, formatLongDate } from "../../utils/dates.js";
import { CalendarChip, CalendarRow, useOpenItem } from "./CalendarItem.jsx";

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const VISIBLE = 3;

// Mes en escritorio. Clic en un hueco libre del día = nueva tarea para ese día.
export function MonthGrid({ days, anchor, byDay, onCreate }) {
  const openItem = useOpenItem();
  return (
    <div>
      <div className="calendar-weekdays" aria-hidden>
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month-grid">
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) ?? [];
          const extra = items.length - VISIBLE;
          return (
            <div
              key={dayKey(day)}
              className={clsx(
                "calendar-cell",
                !isSameMonth(day, anchor) && "calendar-outside",
                isToday(day) && "calendar-today-cell",
              )}
              onClick={() => onCreate(day)}
            >
              <span className="calendar-cell-head">
                <span
                  className={clsx(
                    "calendar-cell-date",
                    isToday(day) && "swipe",
                  )}
                >
                  {fmt(day, "d")}
                </span>
                <button
                  type="button"
                  className="calendar-cell-add"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreate(day);
                  }}
                  aria-label={`Añadir tarea el ${formatLongDate(day)}`}
                >
                  <Plus size={14} weight="bold" aria-hidden />
                </button>
              </span>
              <div className="calendar-cell-items">
                {items.slice(0, VISIBLE).map((item) => (
                  <CalendarChip key={item.id} item={item} onOpen={openItem} />
                ))}
                {extra > 0 ? (
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="calendar-more-button"
                        onClick={(event) => event.stopPropagation()}
                      >
                        +{extra} más
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="calendar-popover"
                        sideOffset={6}
                        collisionPadding={12}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <p className="calendar-popover-title">
                          {formatLongDate(day)}
                        </p>
                        <div className="calendar-popover-list">
                          {items.map((item) => (
                            <CalendarRow
                              key={item.id}
                              item={item}
                              onOpen={openItem}
                            />
                          ))}
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { ChatsCircle } from "@phosphor-icons/react";
import clsx from "clsx";
import { addDays, isWeekend, startOfDay } from "date-fns";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HORIZON_DAYS } from "../../hooks/useDashboard.js";
import { useSubjects } from "../../hooks/useSubjects.js";
import { useUiStore } from "../../store/uiStore.js";
import {
  dayKey,
  fmt,
  formatLongDate,
  formatTime,
  hasTime,
} from "../../utils/dates.js";
import { plural } from "../../utils/format.js";
import { isOverdue } from "../../utils/tasks.js";
import { subjectColor } from "../../utils/subjects.js";
import { TaskTypeIcon } from "../tasks/TaskBits.jsx";

const VISIBLE_PER_DAY = 4;

// Las próximas dos semanas como columnas de días. Cada entrega lleva el fluorescente de su asignatura.
export function Horizon({ tasks, events, now }) {
  const { get } = useSubjects();
  const openTask = useUiStore((state) => state.openTask);
  const navigate = useNavigate();

  const days = useMemo(() => {
    const grouped = new Map();
    const push = (key, item) =>
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    tasks.forEach((task) =>
      push(dayKey(task.dueDate), { kind: "task", task, date: task.dueDate }),
    );
    events.forEach((event) =>
      push(dayKey(event.date), { kind: "room", event, date: event.date }),
    );

    const today = startOfDay(now);
    return Array.from({ length: HORIZON_DAYS }, (_, index) => {
      const date = addDays(today, index);
      const items = (grouped.get(dayKey(date)) ?? []).sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );
      return { date, index, items };
    });
  }, [tasks, events, now]);

  const total = tasks.length;

  return (
    <section className="horizon" aria-labelledby="horizon-title">
      <header className="horizon-header">
        <h2 id="horizon-title" className="section-title">
          Próximas dos semanas
        </h2>
        <span className="horizon-count">
          {total
            ? plural(total, "entrega pendiente", "entregas pendientes")
            : "Nada pendiente"}
        </span>
      </header>

      <div className="horizon-scroller">
        <ol className="horizon-strip">
          {days.map(({ date, index, items }) => {
            const isToday = index === 0;
            const startsWeek = index > 0 && date.getDay() === 1;
            const extra = items.length - VISIBLE_PER_DAY;
            return (
              <li
                key={index}
                className={clsx(
                  "horizon-day",
                  isWeekend(date) && "horizon-weekend",
                  startsWeek && "horizon-week-start",
                )}
                aria-label={`${formatLongDate(date)}: ${items.length ? plural(items.length, "entrega", "entregas") : "sin entregas"}`}
              >
                <div className="horizon-day-head">
                  <span className="horizon-weekday">
                    {isToday ? "hoy" : fmt(date, "EEEEEE")}
                  </span>
                  <span
                    className={clsx(
                      "horizon-date",
                      isToday && clsx("swipe", "horizon-today-date"),
                    )}
                  >
                    {fmt(date, "d")}
                  </span>
                  {date.getDate() === 1 || isToday ? (
                    <span className="horizon-month">{fmt(date, "MMM")}</span>
                  ) : null}
                </div>
                <ul className="horizon-items">
                  {items.slice(0, VISIBLE_PER_DAY).map((item) =>
                    item.kind === "task" ? (
                      <li key={item.task._id}>
                        <button
                          type="button"
                          className={clsx(
                            "horizon-chip",
                            isOverdue(item.task, now) && "horizon-chip-late",
                            !item.task.subject && "horizon-chip-plain",
                          )}
                          style={{
                            "--chip": item.task.subject
                              ? subjectColor(get(item.task.subject)?.color)
                              : undefined,
                          }}
                          onClick={() => openTask(item.task._id)}
                          title={`${item.task.title}${hasTime(item.task.dueDate) ? `, ${formatTime(item.task.dueDate)}` : ""}`}
                        >
                          <span className="horizon-chip-text">
                            <TaskTypeIcon
                              type={item.task.type}
                              size={13}
                              weight="bold"
                            />
                            {item.task.title}
                          </span>
                        </button>
                      </li>
                    ) : (
                      <li key={item.event._id}>
                        <button
                          type="button"
                          className={clsx("horizon-chip", "horizon-chip-room")}
                          onClick={() =>
                            navigate(`/salas/${item.event.roomId}`)
                          }
                          title={`${item.event.kind === "session" ? "Sesión" : "Tarea de sala"}: ${item.event.title}`}
                        >
                          <span className="horizon-chip-text">
                            <ChatsCircle size={13} weight="bold" aria-hidden />
                            {item.event.title}
                          </span>
                        </button>
                      </li>
                    ),
                  )}
                  {extra > 0 ? (
                    <li>
                      <button
                        type="button"
                        className="horizon-more"
                        onClick={() =>
                          navigate(`/calendario?dia=${dayKey(date)}`)
                        }
                      >
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

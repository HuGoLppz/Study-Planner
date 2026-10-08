import { ChatsCircle, Check } from "@phosphor-icons/react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "../../store/uiStore.js";
import { formatTime, hasTime } from "../../utils/dates.js";
import { subjectColor } from "../../utils/subjects.js";
import { TaskTypeIcon } from "../tasks/TaskBits.jsx";

// Abre la tarea en el panel lateral o navega a la sala del evento.
export function useOpenItem() {
  const openTask = useUiStore((state) => state.openTask);
  const navigate = useNavigate();
  return (item) =>
    item.kind === "task"
      ? openTask(item.id)
      : navigate(`/salas/${item.event.roomId}`);
}

export function CalendarChip({ item, showTime = false, onOpen }) {
  const Icon = item.kind === "task" ? null : ChatsCircle;
  return (
    <button
      type="button"
      className={clsx(
        "calendar-chip",
        item.kind !== "task" && "calendar-chip-room",
        item.done && "calendar-chip-done",
        item.overdue && "calendar-chip-late",
        !item.color && "calendar-chip-plain",
      )}
      style={{
        "--chip":
          item.color && item.kind === "task"
            ? subjectColor(item.color)
            : undefined,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      title={item.title}
    >
      {item.done ? (
        <Check size={12} weight="bold" aria-hidden />
      ) : Icon ? (
        <Icon size={12} weight="bold" aria-hidden />
      ) : (
        <TaskTypeIcon type={item.type} size={12} weight="bold" />
      )}
      {showTime && hasTime(item.date) ? (
        <span className="calendar-chip-time">{formatTime(item.date)}</span>
      ) : null}
      <span className="calendar-chip-text">{item.title}</span>
      {item.done ? (
        <span className="visually-hidden"> (completada)</span>
      ) : null}
      {item.overdue ? (
        <span className="visually-hidden"> (atrasada)</span>
      ) : null}
    </button>
  );
}

// Fila de lista (agenda y móvil): más espacio para el título y la hora.
export function CalendarRow({ item, onOpen }) {
  return (
    <button
      type="button"
      className={clsx("calendar-row", item.done && "calendar-row-done")}
      onClick={() => onOpen(item)}
    >
      <span className="calendar-row-time">
        {hasTime(item.date) ? formatTime(item.date) : "Todo el día"}
      </span>
      <span
        className={clsx(
          "calendar-row-mark",
          item.kind !== "task" && "calendar-row-mark-room",
        )}
        style={{ "--chip": item.color ? subjectColor(item.color) : undefined }}
        aria-hidden
      />
      <span className="calendar-row-body">
        <span
          className={clsx("calendar-row-title", item.overdue && "overdue-text")}
        >
          {item.title}
        </span>
        <span className="calendar-row-meta">
          {item.kind === "task"
            ? item.done
              ? "Completada"
              : item.overdue
                ? "Atrasada"
                : "Tarea"
            : item.kind === "session"
              ? `Sala ${item.event.roomName}`
              : `Tarea en ${item.event.roomName}`}
        </span>
      </span>
    </button>
  );
}

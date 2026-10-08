import {
  BookOpenText,
  Check,
  Exam,
  FileText,
  Flask,
  Folders,
  Notebook,
  PresentationChart,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { formatDueShort } from "../../utils/dates.js";
import {
  PRIORITY_LABEL,
  TYPE_LABEL,
  isCompleted,
  isOverdue,
} from "../../utils/tasks.js";

const TYPE_ICONS = {
  assignment: FileText,
  exam: Exam,
  project: Folders,
  practice: Flask,
  reading: BookOpenText,
  presentation: PresentationChart,
  other: Notebook,
};

export function TaskTypeIcon({ type, size = 16, ...props }) {
  const Icon = TYPE_ICONS[type] ?? Notebook;
  return <Icon size={size} aria-hidden {...props} />;
}

export function TaskType({ type }) {
  return (
    <span className="tasks-meta">
      <TaskTypeIcon type={type} />
      {TYPE_LABEL[type]}
    </span>
  );
}

// Urgencia como tres trazos: más trazos, más urgente. El rojo queda reservado a lo atrasado.
export function PriorityMark({ priority }) {
  const level = { low: 1, medium: 2, high: 3 }[priority] ?? 1;
  return (
    <span
      className="tasks-priority"
      title={`Urgencia ${PRIORITY_LABEL[priority]?.toLowerCase()}`}
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={clsx(
            "tasks-priority-bar",
            bar <= level && "tasks-priority-on",
          )}
        />
      ))}
      <span className="visually-hidden">
        Urgencia {PRIORITY_LABEL[priority]}
      </span>
    </span>
  );
}

export function DueLabel({ task, now }) {
  const overdue = isOverdue(task, now);
  return (
    <span className={clsx("tasks-due", overdue && "tasks-due-overdue")}>
      {overdue ? <span className="visually-hidden">Atrasada, </span> : null}
      {formatDueShort(task.dueDate, now)}
    </span>
  );
}

// Círculo para completar o reabrir. Atrasada: borde rojo de corrección.
export function TaskCheck({ task, onToggle, disabled, now }) {
  const done = isCompleted(task);
  return (
    <button
      type="button"
      className={clsx(
        "tasks-check",
        done && "tasks-check-done",
        isOverdue(task, now) && "tasks-check-overdue",
        task.status === "in_progress" && "tasks-check-progress",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(task);
      }}
      disabled={disabled}
      aria-pressed={done}
      aria-label={
        done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`
      }
    >
      <Check size={14} weight="bold" aria-hidden />
    </button>
  );
}

export function GradeBadge({ score }) {
  if (score == null) return null;
  return (
    <span className="tasks-grade-badge" title="Nota">
      {String(score).replace(".", ",")}
    </span>
  );
}

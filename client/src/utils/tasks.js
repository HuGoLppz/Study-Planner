import { addDays, endOfWeek, startOfDay } from "date-fns";
import { WEEK, capitalize, fmt } from "./dates.js";

export const TASK_TYPES = [
  { value: "assignment", label: "Entrega" },
  { value: "exam", label: "Examen" },
  { value: "project", label: "Proyecto" },
  { value: "practice", label: "Práctica" },
  { value: "reading", label: "Lectura" },
  { value: "presentation", label: "Exposición" },
  { value: "other", label: "Otra" },
];

export const PRIORITIES = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

export const STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completada" },
];

const labelOf = (list) =>
  Object.fromEntries(list.map((item) => [item.value, item.label]));
export const TYPE_LABEL = labelOf(TASK_TYPES);
export const PRIORITY_LABEL = labelOf(PRIORITIES);
export const STATUS_LABEL = labelOf(STATUSES);

export const isCompleted = (task) => task.status === "completed";
export const isOverdue = (task, now = new Date()) =>
  !isCompleted(task) && new Date(task.dueDate) < now;

const BUCKETS = [
  { key: "overdue", label: "Atrasadas" },
  { key: "today", label: "Hoy" },
  { key: "tomorrow", label: "Mañana" },
  { key: "week", label: "Esta semana" },
  { key: "next", label: "Próxima semana" },
  { key: "later", label: "Más adelante" },
  { key: "past", label: "Anteriores" },
];

function bucketOf(task, now) {
  const due = new Date(task.dueDate);
  const today = startOfDay(now);
  if (due < today) return isCompleted(task) ? "past" : "overdue";
  if (due < addDays(today, 1))
    return isOverdue(task, now) ? "overdue" : "today";
  if (due < addDays(today, 2)) return "tomorrow";
  const endWeek = endOfWeek(now, WEEK);
  if (due <= endWeek) return "week";
  if (due <= addDays(endWeek, 7)) return "next";
  return "later";
}

// Agrupa una lista ya ordenada por fecha en tramos de tiempo comprensibles.
export function groupByDue(tasks, now = new Date()) {
  const groups = new Map(
    BUCKETS.map((bucket) => [bucket.key, { ...bucket, items: [] }]),
  );
  tasks.forEach((task) => groups.get(bucketOf(task, now)).items.push(task));
  const past = groups.get("past");
  past.items.reverse();
  return [...groups.values()].filter((group) => group.items.length > 0);
}

// Completadas: agrupadas por mes de finalización.
export function groupByCompletion(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const date = new Date(task.completedAt ?? task.dueDate);
    const key = fmt(date, "yyyy-MM");
    if (!groups.has(key))
      groups.set(key, {
        key,
        label: capitalize(fmt(date, "MMMM yyyy")),
        items: [],
      });
    groups.get(key).items.push(task);
  }
  return [...groups.values()];
}

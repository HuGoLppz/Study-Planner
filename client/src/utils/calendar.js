import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { WEEK, capitalize, dayKey, fmt } from './dates.js';
import { isCompleted, isOverdue } from './tasks.js';

export const VIEWS = { month: 'mes', week: 'semana', agenda: 'agenda' };

export function parseDay(value) {
  if (!value) return startOfDay(new Date());
  const date = parseISO(value);
  return isValid(date) ? startOfDay(date) : startOfDay(new Date());
}

export function rangeFor(view, anchor) {
  if (view === 'week') return { from: startOfWeek(anchor, WEEK), to: endOfWeek(anchor, WEEK) };
  return { from: startOfWeek(startOfMonth(anchor), WEEK), to: endOfWeek(endOfMonth(anchor), WEEK) };
}

export function shift(view, anchor, direction) {
  return view === 'week' ? addWeeks(anchor, direction) : addMonths(anchor, direction);
}

export function titleFor(view, anchor) {
  if (view !== 'week') return capitalize(fmt(anchor, 'MMMM yyyy'));
  const from = startOfWeek(anchor, WEEK);
  const to = endOfWeek(anchor, WEEK);
  const sameMonth = from.getMonth() === to.getMonth();
  return sameMonth ? `${fmt(from, 'd')}–${fmt(to, "d 'de' MMMM")}` : `${fmt(from, 'd MMM')}–${fmt(to, 'd MMM')}`;
}

export function daysBetween(from, to) {
  const days = [];
  for (let day = startOfDay(from); day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

// Une tareas propias y eventos de salas en un único formato de "elemento de calendario".
export function buildItems(tasks = [], events = [], subjectOf, now = new Date()) {
  const items = [
    ...tasks.map((task) => ({
      id: task._id,
      kind: 'task',
      date: new Date(task.dueDate),
      title: task.title,
      type: task.type,
      color: subjectOf(task.subject)?.color ?? null,
      done: isCompleted(task),
      overdue: isOverdue(task, now),
      task,
    })),
    ...events.map((event) => ({
      id: event._id,
      kind: event.kind,
      date: new Date(event.date),
      title: event.kind === 'session' ? `Sesión: ${event.title}` : event.title,
      color: event.subject?.color ?? null,
      done: event.status === 'completed',
      overdue: false,
      event,
    })),
  ];
  return items.sort((a, b) => a.date - b.date);
}

export function groupByDay(items) {
  const map = new Map();
  for (const item of items) {
    const key = dayKey(item.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

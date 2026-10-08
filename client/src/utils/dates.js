import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isValid,
  parse,
} from "date-fns";
import { es } from "date-fns/locale";

export const WEEK = { weekStartsOn: 1, locale: es };

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export const capitalize = (text) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

export const fmt = (value, pattern) =>
  format(toDate(value), pattern, { locale: es });

export const dayKey = (value = new Date()) =>
  format(toDate(value), "yyyy-MM-dd");

export const timeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// Una entrega "sin hora" se guarda a las 23:59 del día.
export const hasTime = (value) => {
  const date = toDate(value);
  return !(date.getHours() === 23 && date.getMinutes() === 59);
};

export const formatTime = (value) => fmt(value, "HH:mm");

export const formatLongDate = (value) =>
  capitalize(fmt(value, "EEEE, d 'de' MMMM"));

export const formatDateTime = (value) =>
  hasTime(value)
    ? `${formatLongDate(value)}, ${formatTime(value)}`
    : formatLongDate(value);

// "Hoy", "Mañana", "jueves", "13 oct" + hora si la tiene
export function formatDueShort(value, now = new Date()) {
  const date = toDate(value);
  const diff = differenceInCalendarDays(date, now);
  let label;
  if (diff === 0) label = "Hoy";
  else if (diff === 1) label = "Mañana";
  else if (diff === -1) label = "Ayer";
  else if (diff > 1 && diff < 7) label = capitalize(fmt(date, "EEEE"));
  else
    label = fmt(
      date,
      date.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yyyy",
    );
  return hasTime(date) ? `${label}, ${formatTime(date)}` : label;
}

// "vence hoy", "en 3 días", "hace 2 días"
export function formatRelativeDue(value, now = new Date()) {
  const diff = differenceInCalendarDays(toDate(value), now);
  if (diff === 0) return "vence hoy";
  if (diff === 1) return "vence mañana";
  if (diff === -1) return "venció ayer";
  if (diff > 1) return `en ${diff} días`;
  return `hace ${Math.abs(diff)} días`;
}

export function formatDaySeparator(value, now = new Date()) {
  const diff = differenceInCalendarDays(toDate(value), now);
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  return formatLongDate(value);
}

export const formatAgo = (value) =>
  formatDistanceToNowStrict(toDate(value), { addSuffix: true, locale: es });

export const toDateInput = (value) =>
  value ? format(toDate(value), "yyyy-MM-dd") : "";

export const toTimeInput = (value) =>
  value && hasTime(value) ? format(toDate(value), "HH:mm") : "";

// Combina los campos de fecha y hora de un formulario en una fecha local.
export function combineDateTime(dateInput, timeInput) {
  if (!dateInput) return null;
  const date = parse(
    `${dateInput} ${timeInput || "23:59"}`,
    "yyyy-MM-dd HH:mm",
    new Date(),
  );
  return isValid(date) ? date : null;
}

export const sameDay = (a, b) => isSameDay(toDate(a), toDate(b));

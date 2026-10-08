import { endOfWeek } from "date-fns";
import { WEEK, formatDueShort } from "./dates.js";
import { plural } from "./format.js";

const count = (n, one, many) => (n === 1 ? `una ${one}` : `${n} ${many}`);

// Titular de la pantalla Hoy, escrito con los datos reales del usuario.
export function buildHeadline({ horizon, summary, now }) {
  if (summary.total === 0) {
    return {
      title: "Empieza apuntando tu próxima entrega.",
      lead: "Con tus tareas y fechas, aquí verás cada día qué toca y qué se acerca.",
    };
  }

  const weekEnd = endOfWeek(now, WEEK);
  const thisWeek = horizon.filter(
    (task) =>
      new Date(task.dueDate) <= weekEnd && new Date(task.dueDate) >= now,
  ).length;
  const overdue = summary.overdue;

  let title;
  if (thisWeek === 0 && overdue === 0)
    title = "Esta semana no tienes entregas pendientes.";
  else if (overdue === 0)
    title = `Tienes ${count(thisWeek, "entrega", "entregas")} esta semana.`;
  else if (thisWeek === 0)
    title = `Tienes ${count(overdue, "tarea atrasada", "tareas atrasadas")}.`;
  else
    title = `Tienes ${count(thisWeek, "entrega", "entregas")} esta semana y ${plural(overdue, "atrasada", "atrasadas")}.`;

  const next = horizon.find((task) => new Date(task.dueDate) >= now);
  const lead = next
    ? `Lo siguiente: «${next.title}», ${formatDueShort(next.dueDate, now).toLowerCase()}.`
    : summary.pending > 0
      ? "No hay nada más en las próximas dos semanas."
      : "Todo lo que tenías está completado.";

  return { title, lead };
}

import { iso, sql } from "../database/db.js";
import { TASK_SELECT, toTask } from "../models/task.model.js";
import { ApiError } from "../utils/ApiError.js";
import { round } from "../utils/text.js";
import { cachedAcademic, invalidateAcademic } from "./academicCache.js";
import { OVERDUE_SQL, getTask, saveGrade } from "./task.service.js";

const WEEKS_OF_HISTORY = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

function subjectLookup(user) {
  const map = new Map(
    user.subjects.map((subject) => [String(subject._id), subject]),
  );
  return (id) => {
    const subject = id == null ? null : map.get(String(id));
    return subject
      ? { _id: subject._id, name: subject.name, color: subject.color }
      : null;
  };
}

// Crear un Intl.DateTimeFormat es muy caro (era el 27 % de la CPU de la API en la prueba de carga):
// se crea uno por zona horaria y se reutiliza. Las zonas no válidas se guardan como null.
const formatters = new Map();
function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    let formatter = null;
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
      });
    } catch {
      // zona horaria desconocida
    }
    formatters.set(timeZone, formatter);
  }
  return formatters.get(timeZone);
}

export const isValidTimeZone = (timeZone) => Boolean(formatterFor(timeZone));

// Fecha y hora "de pared" de un instante en una zona horaria.
function zonedParts(date, timeZone) {
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      get("weekday"),
    ),
  };
}

const offsetOf = (date, timeZone) => {
  const p = zonedParts(date, timeZone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(date.getTime() / 1000) * 1000
  );
};

// Lunes a las 00:00 (hora local de la zona) de la semana de `date`, como instante UTC.
export function startOfWeek(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const localMidnight = Date.UTC(p.year, p.month - 1, p.day - p.weekday);
  const guess = localMidnight - offsetOf(new Date(localMidnight), timeZone);
  return new Date(localMidnight - offsetOf(new Date(guess), timeZone));
}

const isGradedSql = "c.calificacion IS NOT NULL";

// Inicios de semana (lunes 00:00 locales) de las últimas `weeks` semanas más la actual, de la más
// antigua a la más reciente. Se calculan una vez por consulta, no una vez por tarea.
function weekStarts(now, timeZone, weeks) {
  const starts = [startOfWeek(now, timeZone)];
  while (starts.length <= weeks) {
    // Tres días antes de un lunes siempre es la semana anterior, haya o no cambio de hora.
    starts.unshift(
      startOfWeek(new Date(starts[0].getTime() - 3 * DAY_MS), timeZone),
    );
  }
  return starts;
}

// Todas las estadísticas académicas de un usuario. Se guardan 30 s por usuario y zona horaria; las
// escrituras del usuario las invalidan (academicCache.js).
export function computeAcademicStats(
  user,
  { now = new Date(), timeZone = "UTC" } = {},
) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return cachedAcademic(user._id, tz, () => queryAcademicStats(user, now, tz));
}

async function queryAcademicStats(user, now, tz) {
  const since = new Date(now.getTime() - WEEKS_OF_HISTORY * 7 * DAY_MS);
  const params = { userId: user._id, now: iso(now) };
  const from =
    "FROM Tareas t LEFT JOIN Calificaciones c ON c.tarea_id = t.tarea_id WHERE t.usuario_id = @userId";

  // Las cuatro consultas son independientes: van en paralelo por conexiones distintas.
  const [totals, bySubjectRows, evolutionRows, completions] = await Promise.all(
    [
      sql(
        `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE t.estado = 'completed') AS completed,
              COUNT(*) FILTER (WHERE ${OVERDUE_SQL}) AS overdue,
              COUNT(c.calificacion) AS graded,
              AVG(c.calificacion) AS average, MAX(c.calificacion) AS best, MIN(c.calificacion) AS lowest
         ${from}`,
      ).get(params),
      // Las tareas de asignaturas borradas tienen asignatura_id NULL (ON DELETE SET NULL).
      sql(
        `SELECT t.asignatura_id AS subject, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE t.estado = 'completed') AS completed,
              COUNT(*) FILTER (WHERE ${OVERDUE_SQL}) AS overdue,
              COUNT(c.calificacion) AS graded, AVG(c.calificacion) AS average
         ${from} GROUP BY t.asignatura_id`,
      ).all(params),
      sql(
        `SELECT t.tarea_id, t.titulo, t.tipo_actividad, t.asignatura_id, t.fecha_entrega, c.calificacion,
              AVG(c.calificacion) OVER (ORDER BY t.fecha_entrega, t.tarea_id
                                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS media_acumulada
         ${from} AND ${isGradedSql}
        ORDER BY t.fecha_entrega, t.tarea_id`,
      ).all(params),
      sql(
        `SELECT t.fecha_completada FROM Tareas t
        WHERE t.usuario_id = @userId AND t.estado = 'completed' AND t.fecha_completada >= @since`,
      ).all({ userId: user._id, since: iso(since) }),
    ],
  );

  // Las semanas (lunes a domingo, hora local del usuario) se agrupan aquí, comparando cada fecha
  // con los inicios de semana ya calculados.
  const starts = weekStarts(now, tz, WEEKS_OF_HISTORY).map((date) =>
    date.toISOString(),
  );
  const weekly = new Map();
  for (const { fecha_completada: completedAt } of completions) {
    let week = starts.length - 1;
    while (week > 0 && completedAt < starts[week]) week -= 1;
    if (completedAt < starts[week]) continue;
    weekly.set(starts[week], (weekly.get(starts[week]) ?? 0) + 1);
  }

  const subjectOf = subjectLookup(user);
  const bySubject = bySubjectRows
    .map((row) => ({
      subject: subjectOf(row.subject),
      total: row.total,
      completed: row.completed,
      pending: row.total - row.completed,
      overdue: row.overdue,
      graded: row.graded,
      average: round(row.average),
      progress: row.total ? round(row.completed / row.total, 4) : 0,
    }))
    .sort((a, b) => {
      if (!a.subject) return 1;
      if (!b.subject) return -1;
      return a.subject.name.localeCompare(b.subject.name, "es");
    });

  return {
    totals: {
      total: totals.total,
      completed: totals.completed,
      pending: totals.total - totals.completed,
      overdue: totals.overdue,
      graded: totals.graded,
      ungraded: totals.completed - totals.graded,
      progress: totals.total ? round(totals.completed / totals.total, 4) : 0,
    },
    average: totals.graded ? round(totals.average) : null,
    best: totals.best ?? null,
    lowest: totals.lowest ?? null,
    bySubject,
    evolution: evolutionRows.map((row) => ({
      taskId: String(row.tarea_id),
      title: row.titulo,
      type: row.tipo_actividad,
      subject: subjectOf(row.asignatura_id),
      date: row.fecha_entrega,
      score: row.calificacion,
      runningAverage: round(row.media_acumulada),
    })),
    weekly: [...weekly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, completed]) => ({ weekStart, completed })),
  };
}

export async function listGradedTasks(userId, { subject } = {}) {
  const bySubject = subject ? "AND t.asignatura_id = @subject" : "";
  const rows = await sql(
    `${TASK_SELECT} WHERE t.usuario_id = @userId AND ${isGradedSql} ${bySubject} ORDER BY t.fecha_entrega DESC`,
  ).all({ userId, subject });
  return rows.map(toTask);
}

export async function setGrade(userId, taskId, score) {
  const task = await getTask(userId, taskId);
  if (task.status !== "completed") {
    throw ApiError.conflict(
      "Marca la tarea como completada antes de ponerle nota",
      "TASK_NOT_COMPLETED",
    );
  }
  await saveGrade(taskId, score);
  invalidateAcademic(userId);
  return getTask(userId, taskId);
}

export async function removeGrade(userId, taskId) {
  await getTask(userId, taskId);
  await sql("DELETE FROM Calificaciones WHERE tarea_id = ?").run(taskId);
  invalidateAcademic(userId);
  return getTask(userId, taskId);
}

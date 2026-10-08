import { iso, nowIso, sql, transaction } from "../database/db.js";
import { TASK_SELECT, toTask } from "../models/task.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { escapeLike, normalizeText } from "../utils/text.js";
import { invalidateAcademic } from "./academicCache.js";

const SORTS = {
  due: "t.fecha_entrega ASC, t.tarea_id ASC",
  "-due": "t.fecha_entrega DESC, t.tarea_id DESC",
  created: "t.fecha_creacion ASC, t.tarea_id ASC",
  "-created": "t.fecha_creacion DESC, t.tarea_id DESC",
  completed: "t.fecha_completada DESC NULLS LAST, t.fecha_entrega DESC",
  priority:
    "CASE t.urgencia WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.fecha_entrega ASC",
};

// "Atrasada" no se guarda: se calcula con la hora de la petición.
export const OVERDUE_SQL = "t.estado <> 'completed' AND t.fecha_entrega < @now";

const NOT_FOUND = "Esta tarea no existe o se ha eliminado";

// Una asignatura solo puede usarse si pertenece al propietario de la tarea (la base de datos
// también lo comprueba con un trigger; aquí se valida antes para responder con un 422 claro).
export function assertOwnSubject(user, subjectId) {
  if (
    subjectId &&
    !user.subjects.some((subject) => sameId(subject._id, subjectId))
  ) {
    throw ApiError.unprocessable("La asignatura no existe", {
      subjectId: "Elige una de tus asignaturas",
    });
  }
}

function buildWhere(userId, query, now) {
  const where = ["t.usuario_id = @userId"];
  const params = { userId, now: iso(now) };

  if (query.status === "pending") where.push("t.estado <> 'completed'");
  if (query.status === "completed") where.push("t.estado = 'completed'");
  if (query.status === "overdue") where.push(OVERDUE_SQL);

  if (query.subject === "none") where.push("t.asignatura_id IS NULL");
  else if (query.subject) {
    where.push("t.asignatura_id = @subject");
    params.subject = query.subject;
  }
  if (query.type) {
    where.push("t.tipo_actividad = @type");
    params.type = query.type;
  }
  if (query.priority) {
    where.push("t.urgencia = @priority");
    params.priority = query.priority;
  }
  if (query.from) {
    where.push("t.fecha_entrega >= @from");
    params.from = iso(query.from);
  }
  if (query.to) {
    where.push("t.fecha_entrega <= @to");
    params.to = iso(query.to);
  }
  if (query.q) {
    // Sin distinguir mayúsculas ni tildes: "calculo" encuentra "Cálculo".
    where.push(
      "(normalizar(t.titulo) LIKE @q ESCAPE '\\' OR normalizar(t.descripcion) LIKE @q ESCAPE '\\')",
    );
    params.q = `%${escapeLike(normalizeText(query.q))}%`;
  }
  return { where: where.join(" AND "), params };
}

export async function listTasks(user, query, now = new Date()) {
  const { where, params } = buildWhere(user._id, query, now);
  const offset = (query.page - 1) * query.limit;

  const [rows, count] = await Promise.all([
    sql(
      `${TASK_SELECT} WHERE ${where} ORDER BY ${SORTS[query.sort]} LIMIT @limit OFFSET @offset`,
    ).all({
      ...params,
      limit: query.limit,
      offset,
    }),
    sql(`SELECT COUNT(*) AS total FROM Tareas t WHERE ${where}`).get(params),
  ]);
  const items = rows.map(toTask);
  return {
    items,
    total: count.total,
    page: query.page,
    hasMore: offset + items.length < count.total,
  };
}

// Pendientes que vencen dentro del rango (horizonte del dashboard).
export async function listUpcoming(userId, { from, to, limit }) {
  const rows = await sql(
    `${TASK_SELECT} WHERE t.usuario_id = @userId AND t.estado <> 'completed'
       AND t.fecha_entrega BETWEEN @from AND @to ORDER BY t.fecha_entrega LIMIT @limit`,
  ).all({ userId, from: iso(from), to: iso(to), limit });
  return rows.map(toTask);
}

export async function listOverdue(userId, { now = new Date(), limit }) {
  const rows = await sql(
    `${TASK_SELECT} WHERE t.usuario_id = @userId AND ${OVERDUE_SQL} ORDER BY t.fecha_entrega LIMIT @limit`,
  ).all({
    userId,
    now: iso(now),
    limit,
  });
  return rows.map(toTask);
}

export async function summarizeTasks(userId, now = new Date()) {
  const row = await sql(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE t.estado = 'completed') AS completed,
            COUNT(*) FILTER (WHERE t.estado = 'in_progress') AS "inProgress",
            COUNT(*) FILTER (WHERE ${OVERDUE_SQL}) AS overdue
       FROM Tareas t WHERE t.usuario_id = @userId`,
  ).get({ userId, now: iso(now) });

  return { ...row, pending: row.total - row.completed };
}

export async function getTask(userId, taskId) {
  const row = await sql(
    `${TASK_SELECT} WHERE t.tarea_id = ? AND t.usuario_id = ?`,
  ).get(taskId, userId);
  if (!row) throw ApiError.notFound(NOT_FOUND, "TASK_NOT_FOUND");
  return toTask(row);
}

// Al cambiar de estado se fija o se borra la fecha de completado. Reabrir una tarea borra su
// nota (trigger tr_tareas_reabrir_borra_nota).
const completedAtFor = (status) => (status === "completed" ? nowIso() : null);

// La caché de estadísticas se invalida siempre DESPUÉS de confirmar la escritura: si se hiciera
// antes, una petición simultánea podría volver a guardar los datos de antes del cambio.

export async function createTask(user, data) {
  assertOwnSubject(user, data.subjectId);

  const { lastInsertRowid } = await sql(
    `INSERT INTO Tareas (usuario_id, asignatura_id, titulo, descripcion, tipo_actividad, urgencia, estado,
                         fecha_entrega, fecha_completada)
     VALUES (@userId, @subjectId, @title, @description, @type, @priority, @status, @dueDate, @completedAt)
     RETURNING tarea_id`,
  ).run({
    userId: user._id,
    subjectId: data.subjectId,
    title: data.title,
    description: data.description,
    type: data.type,
    priority: data.priority,
    status: data.status,
    dueDate: iso(data.dueDate),
    completedAt: completedAtFor(data.status),
  });
  invalidateAcademic(user._id);
  return getTask(user._id, lastInsertRowid);
}

const UPDATABLE = {
  title: "titulo",
  description: "descripcion",
  type: "tipo_actividad",
  priority: "urgencia",
};

export async function updateTask(user, taskId, data) {
  const task = await getTask(user._id, taskId);
  const set = { fecha_actualizacion: nowIso() };

  for (const [field, column] of Object.entries(UPDATABLE)) {
    if (data[field] !== undefined) set[column] = data[field];
  }
  if (data.subjectId !== undefined) {
    assertOwnSubject(user, data.subjectId);
    set.asignatura_id = data.subjectId;
  }
  if (data.dueDate && iso(data.dueDate) !== task.dueDate) {
    set.fecha_entrega = iso(data.dueDate);
    set.recordatorio_enviado = null; // vuelve a avisar con la nueva fecha
  }
  if (data.status && data.status !== task.status) {
    set.estado = data.status;
    set.fecha_completada = completedAtFor(data.status);
  }

  const assignments = Object.keys(set)
    .map((column) => `${column} = @${column}`)
    .join(", ");
  await sql(
    `UPDATE Tareas SET ${assignments} WHERE tarea_id = @taskId AND usuario_id = @userId`,
  ).run({
    ...set,
    taskId,
    userId: user._id,
  });
  invalidateAcademic(user._id);
  return getTask(user._id, taskId);
}

// Cambia el estado si hace falta. Devuelve si ha cambiado (quien llama invalida la caché).
async function setStatus(userId, taskId, status) {
  const task = await getTask(userId, taskId);
  if (task.status === status) return false;
  await sql(
    "UPDATE Tareas SET estado = ?, fecha_completada = ?, fecha_actualizacion = ? WHERE tarea_id = ?",
  ).run(status, completedAtFor(status), nowIso(), taskId);
  return true;
}

export async function saveGrade(taskId, score) {
  await sql(
    `INSERT INTO Calificaciones (tarea_id, calificacion, fecha_registro) VALUES (?, ?, ?)
     ON CONFLICT (tarea_id) DO UPDATE SET calificacion = excluded.calificacion, fecha_registro = excluded.fecha_registro`,
  ).run(taskId, score, nowIso());
}

export async function completeTask(user, taskId, { score } = {}) {
  await transaction(async () => {
    await setStatus(user._id, taskId, "completed");
    if (score !== undefined && score !== null) await saveGrade(taskId, score);
  });
  invalidateAcademic(user._id);
  return getTask(user._id, taskId);
}

export async function reopenTask(user, taskId) {
  if (await setStatus(user._id, taskId, "pending"))
    invalidateAcademic(user._id);
  return getTask(user._id, taskId);
}

export async function deleteTask(userId, taskId) {
  const { changes } = await sql(
    "DELETE FROM Tareas WHERE tarea_id = ? AND usuario_id = ?",
  ).run(taskId, userId);
  if (changes === 0) throw ApiError.notFound(NOT_FOUND, "TASK_NOT_FOUND");
  invalidateAcademic(userId);
}

import { nowIso, sql } from "../database/db.js";
import {
  NOTIFICATION_SELECT,
  toNotification,
} from "../models/notification.model.js";
import { emitToUser } from "../sockets/emitter.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { logger } from "../utils/logger.js";

const NOT_FOUND = "Esta notificación ya no existe";
const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

const findNotification = async (notificationId) =>
  toNotification(
    await sql(`${NOTIFICATION_SELECT} WHERE n.notificacion_id = ?`).get(
      notificationId,
    ),
  );

// Las notificaciones nunca deben romper la operación que las origina: los errores se registran.
// Todas las copias se crean en una sola sentencia (unnest) y se devuelven con el remitente.
export async function notify({
  recipients,
  type,
  actor = null,
  room = null,
  task = null,
  data = {},
}) {
  const targets = [...new Set(recipients.map(String))].filter(
    (id) => !sameId(id, actor),
  );
  if (targets.length === 0) return [];

  try {
    const rows = await sql(
      `WITH nuevas AS (
         INSERT INTO Notificaciones (usuario_id, remitente_id, tipo, sala_id, tarea_id, datos, fecha_envio)
         SELECT destinatario, @actor::text, @type::text, @room::text, @task::integer, @data::jsonb, @createdAt::timestamptz
           FROM unnest(@targets::text[]) AS destinatario
         RETURNING *)
       SELECT n.*, a.usuario_id AS actor_id, a.nombre AS actor_name, a.identificador AS actor_handle,
              a.foto_actualizada AS actor_avatar
         FROM nuevas n LEFT JOIN Usuarios a ON a.usuario_id = n.remitente_id`,
    ).all({
      targets,
      actor,
      type,
      room,
      task,
      data: JSON.stringify(data),
      createdAt: nowIso(),
    });

    const created = rows.map(toNotification);
    created.forEach((notification) =>
      emitToUser(notification.recipient, "notification:new", notification),
    );
    return created;
  } catch (error) {
    logger.error("No se pudo crear la notificación", error);
    return [];
  }
}

export async function listNotifications(userId, { unread, before, limit }) {
  const where = ["n.usuario_id = @userId"];
  if (unread !== undefined) where.push(unread ? "NOT n.leida" : "n.leida");
  if (before) where.push("n.notificacion_id < @before");

  const rows = await sql(
    `${NOTIFICATION_SELECT} WHERE ${where.join(" AND ")} ORDER BY n.notificacion_id DESC LIMIT @limit`,
  ).all({
    userId,
    before,
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toNotification);
  return { items, nextCursor: hasMore ? items.at(-1)._id : null };
}

export async function countUnread(userId) {
  return (
    await sql(
      "SELECT COUNT(*) AS count FROM Notificaciones WHERE usuario_id = ? AND NOT leida",
    ).get(userId)
  ).count;
}

export async function setRead(userId, notificationId, read) {
  const { changes } = await sql(
    "UPDATE Notificaciones SET leida = ?, fecha_lectura = ? WHERE notificacion_id = ? AND usuario_id = ?",
  ).run(read, read ? nowIso() : null, notificationId, userId);
  if (changes === 0) throw ApiError.notFound(NOT_FOUND);
  return findNotification(notificationId);
}

export async function markAllRead(userId) {
  const { changes } = await sql(
    "UPDATE Notificaciones SET leida = true, fecha_lectura = ? WHERE usuario_id = ? AND NOT leida",
  ).run(nowIso(), userId);
  return changes;
}

export async function removeNotification(userId, notificationId) {
  const { changes } = await sql(
    "DELETE FROM Notificaciones WHERE notificacion_id = ? AND usuario_id = ?",
  ).run(notificationId, userId);
  if (changes === 0) throw ApiError.notFound(NOT_FOUND);
}

// Cuando una solicitud o invitación se resuelve por otra vía, su aviso deja de pedir acción.
// Solo filtra por los criterios que se pasan.
export async function resolveActionable({
  type,
  recipient,
  actor,
  room,
  requestId,
}) {
  const where = ["NOT leida", "tipo = @type"];
  if (recipient) where.push("usuario_id = @recipient");
  if (actor) where.push("remitente_id = @actor");
  if (room) where.push("sala_id = @room");
  if (requestId) where.push("datos->>'requestId' = @requestId");

  await sql(
    `UPDATE Notificaciones SET leida = true, fecha_lectura = @now WHERE ${where.join(" AND ")}`,
  ).run({
    type,
    recipient,
    actor,
    room,
    requestId: requestId == null ? null : String(requestId),
    now: nowIso(),
  });
}

// Al retirar una invitación a una sala, su aviso sin leer desaparece.
export async function removeRoomInvitationNotice(userId, roomId) {
  await sql(
    "DELETE FROM Notificaciones WHERE usuario_id = ? AND tipo = 'room_invitation' AND sala_id = ? AND NOT leida",
  ).run(userId, roomId);
}

// Los avisos se conservan 180 días.
export async function purgeOldNotifications(now = new Date()) {
  const limit = new Date(now.getTime() - RETENTION_MS).toISOString();
  return (
    await sql("DELETE FROM Notificaciones WHERE fecha_envio < ?").run(limit)
  ).changes;
}

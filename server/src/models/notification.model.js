import { summaryColumns, summaryFrom } from "./user.model.js";

export const NOTIFICATION_SELECT = `
  SELECT n.*, ${summaryColumns("a", "actor")}
    FROM Notificaciones n LEFT JOIN Usuarios a ON a.usuario_id = n.remitente_id`;

export function toNotification(row) {
  return {
    _id: String(row.notificacion_id),
    recipient: row.usuario_id,
    type: row.tipo,
    actor: summaryFrom(row, "actor"),
    room: row.sala_id,
    task: row.tarea_id == null ? null : String(row.tarea_id),
    data: row.datos, // jsonb: PostgreSQL ya lo devuelve como objeto
    read: row.leida,
    readAt: row.fecha_lectura,
    createdAt: row.fecha_envio,
  };
}

import { summaryColumns, summaryFrom } from "./user.model.js";

export const subjectOfRoom = (row) =>
  row.asignatura_nombre
    ? { name: row.asignatura_nombre, color: row.asignatura_color }
    : null;

export function toRoomTask(row) {
  return {
    _id: String(row.tarea_sala_id),
    title: row.titulo,
    description: row.descripcion,
    dueDate: row.fecha_entrega,
    assignee: row.usuario_id,
    status: row.estado,
    createdBy: row.creador_id,
    completedAt: row.fecha_completada,
    createdAt: row.fecha_creacion,
    updatedAt: row.fecha_actualizacion,
  };
}

export const MESSAGE_SELECT = `
  SELECT m.*, ${summaryColumns("u", "author")}
    FROM Mensajes_Salas m JOIN Usuarios u ON u.usuario_id = m.usuario_id`;

export function toMessage(row) {
  return {
    _id: String(row.mensaje_id),
    room: row.sala_id,
    author: summaryFrom(row, "author"),
    body: row.mensaje,
    editedAt: row.fecha_edicion,
    createdAt: row.fecha_envio,
  };
}

export const FILE_SELECT = `
  SELECT f.*, ${summaryColumns("u", "uploader")}
    FROM Archivos_Salas f LEFT JOIN Usuarios u ON u.usuario_id = f.usuario_id`;

export function toRoomFile(row) {
  return {
    _id: String(row.archivo_id),
    room: row.sala_id,
    originalName: row.nombre_archivo,
    mimeType: row.tipo_mime,
    size: row.tamano_bytes,
    uploadedBy: summaryFrom(row, "uploader") ?? { _id: null, name: null },
    createdAt: row.fecha_subida,
  };
}

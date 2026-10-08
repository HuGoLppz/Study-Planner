import { LIMITS } from "../config/constants.js";
import { nowIso, sql, transaction } from "../database/db.js";
import { FILE_SELECT, toRoomFile } from "../models/room.model.js";
import { emitToRoom } from "../sockets/emitter.js";
import { removeRoomFile, roomFileDownload } from "../uploads/storage.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";

export async function listFiles(roomId) {
  const rows = await sql(
    `${FILE_SELECT} WHERE f.sala_id = ? ORDER BY f.fecha_subida DESC, f.archivo_id DESC`,
  ).all(roomId);
  return rows.map(toRoomFile);
}

// Comprobación rápida antes de recibir el archivo (el contador de la sala lo mantiene un trigger).
export async function assertFileQuota(room) {
  const { archivos } = await sql(
    "SELECT archivos FROM Salas WHERE sala_id = ?",
  ).get(room._id);
  if (archivos >= LIMITS.filesPerRoom) {
    throw ApiError.conflict(
      `La sala ha llegado al máximo de ${LIMITS.filesPerRoom} archivos`,
      "FILE_LIMIT",
    );
  }
}

// El archivo ya está en el almacenamiento (uploads/storage.js): aquí se registra. Si falla, se borra.
export async function createFile(room, user, upload) {
  try {
    const fileId = await transaction(async () => {
      const createdAt = nowIso();
      const { lastInsertRowid } = await sql(
        `INSERT INTO Archivos_Salas (sala_id, usuario_id, nombre_archivo, ruta_archivo, tipo_mime, tamano_bytes, fecha_subida)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING archivo_id`,
      ).run(
        room._id,
        user._id,
        upload.originalname,
        upload.filename,
        upload.canonicalMime,
        upload.size,
        createdAt,
      );
      await sql("UPDATE Salas SET ultima_actividad = ? WHERE sala_id = ?").run(
        createdAt,
        room._id,
      );
      return lastInsertRowid;
    });

    const payload = toRoomFile(
      await sql(`${FILE_SELECT} WHERE f.archivo_id = ?`).get(fileId),
    );
    emitToRoom(room._id, "room:files", { roomId: room._id });
    return payload;
  } catch (error) {
    await removeRoomFile(room._id, upload.filename).catch(() => {});
    throw error;
  }
}

async function findFile(roomId, fileId) {
  const row = await sql(
    "SELECT * FROM Archivos_Salas WHERE archivo_id = ? AND sala_id = ?",
  ).get(fileId, roomId);
  if (!row) throw ApiError.notFound("Este archivo ya no existe");
  return row;
}

// Con S3, un enlace firmado de 60 s (la descarga no pasa por la API); con disco, la ruta del archivo.
export async function getDownload(roomId, fileId) {
  const row = await findFile(roomId, fileId);
  const file = toRoomFile(row);
  const download = await roomFileDownload(roomId, row.ruta_archivo, {
    fileName: file.originalName,
    contentType: file.mimeType,
  });
  if (!download)
    throw ApiError.notFound("El archivo ya no está disponible en el servidor");
  return { ...download, file };
}

export async function deleteFile(room, user, membership, fileId) {
  const row = await findFile(room._id, fileId);
  if (!sameId(row.usuario_id, user._id) && membership.role !== "admin") {
    throw ApiError.forbidden(
      "Solo quien subió el archivo o un administrador puede eliminarlo",
    );
  }

  await sql("DELETE FROM Archivos_Salas WHERE archivo_id = ?").run(fileId);
  await removeRoomFile(room._id, row.ruta_archivo);
  emitToRoom(room._id, "room:files", { roomId: room._id });
}

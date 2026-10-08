import { nowIso, sql, transaction } from "../database/db.js";
import { MESSAGE_SELECT, toMessage } from "../models/room.model.js";
import { emitToRoom } from "../sockets/emitter.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";

const getMessage = async (messageId) =>
  toMessage(
    await sql(`${MESSAGE_SELECT} WHERE m.mensaje_id = ?`).get(messageId),
  );

// Historial paginado hacia atrás con cursor sobre mensaje_id. Se devuelve en orden cronológico.
export async function listMessages(roomId, { before, limit }) {
  const rows = await sql(
    `${MESSAGE_SELECT} WHERE m.sala_id = @roomId ${before ? "AND m.mensaje_id < @before" : ""}
      ORDER BY m.mensaje_id DESC LIMIT @limit`,
  ).all({ roomId, before, limit: limit + 1 });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    items: page.reverse().map(toMessage),
    nextCursor: hasMore ? String(page[0].mensaje_id) : null,
  };
}

export async function createMessage(room, author, body) {
  const createdAt = nowIso();
  const messageId = await transaction(async () => {
    const { lastInsertRowid } = await sql(
      "INSERT INTO Mensajes_Salas (sala_id, usuario_id, mensaje, fecha_envio) VALUES (?, ?, ?, ?) RETURNING mensaje_id",
    ).run(room._id, author._id, body, createdAt);
    await sql("UPDATE Salas SET ultima_actividad = ? WHERE sala_id = ?").run(
      createdAt,
      room._id,
    );
    return lastInsertRowid;
  });

  const payload = await getMessage(messageId);
  emitToRoom(room._id, "message:new", payload);
  return payload;
}

async function findInRoom(roomId, messageId) {
  const row = await sql(
    "SELECT * FROM Mensajes_Salas WHERE mensaje_id = ? AND sala_id = ?",
  ).get(messageId, roomId);
  if (!row) throw ApiError.notFound("Este mensaje ya no existe");
  return row;
}

export async function updateMessage(room, user, messageId, body) {
  const message = await findInRoom(room._id, messageId);
  if (!sameId(message.usuario_id, user._id))
    throw ApiError.forbidden("Solo puedes editar tus propios mensajes");

  await sql(
    "UPDATE Mensajes_Salas SET mensaje = ?, fecha_edicion = ? WHERE mensaje_id = ?",
  ).run(body, nowIso(), messageId);

  const payload = await getMessage(messageId);
  emitToRoom(room._id, "message:updated", payload);
  return payload;
}

export async function deleteMessage(room, user, membership, messageId) {
  const message = await findInRoom(room._id, messageId);
  if (!sameId(message.usuario_id, user._id) && membership.role !== "admin") {
    throw ApiError.forbidden("Solo puedes eliminar tus mensajes");
  }

  await sql("DELETE FROM Mensajes_Salas WHERE mensaje_id = ?").run(messageId);
  emitToRoom(room._id, "message:deleted", {
    _id: String(messageId),
    room: room._id,
  });
}

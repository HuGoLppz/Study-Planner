import { nowIso, sql } from "../database/db.js";
import { summaryColumns, summaryFrom } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { notify, resolveActionable } from "./notification.service.js";

// La pareja se busca siempre como (menor, mayor): es la expresión que indexa ux_amigos_pareja.
// COLLATE "C" compara por código de carácter, como el sort() de JavaScript de pairParams.
const PAIR_WHERE =
  'LEAST(usuario_id COLLATE "C", amigo_id COLLATE "C") = @low AND GREATEST(usuario_id COLLATE "C", amigo_id COLLATE "C") = @high';
const pairParams = (a, b) => {
  const [low, high] = [String(a), String(b)].sort();
  return { low, high };
};

const findPair = (a, b) =>
  sql(`SELECT * FROM Amigos WHERE ${PAIR_WHERE}`).get(pairParams(a, b));

const withStudies = (row, prefix) => ({
  ...summaryFrom(row, prefix),
  studies: row.estudios,
  course: row.curso,
});

// Amigos por orden alfabético (sin distinguir tildes). Con `limit` (dashboard) solo los primeros.
export async function listFriends(userId, { limit = null } = {}) {
  const rows = await sql(
    `SELECT a.fecha_amistad, ${summaryColumns("u", "friend")}, u.estudios, u.curso
       FROM Amigos a
       JOIN Usuarios u ON u.usuario_id = CASE WHEN a.usuario_id = @me THEN a.amigo_id ELSE a.usuario_id END
      WHERE (a.usuario_id = @me OR a.amigo_id = @me) AND a.estado = 'accepted'
      ORDER BY u.nombre_busqueda
      LIMIT @limit`,
  ).all({ me: userId, limit });

  return rows
    .map((row) => ({
      ...withStudies(row, "friend"),
      friendsSince: row.fecha_amistad,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function countFriends(userId) {
  const row = await sql(
    "SELECT COUNT(*) AS count FROM Amigos WHERE (usuario_id = @me OR amigo_id = @me) AND estado = 'accepted'",
  ).get({
    me: userId,
  });
  return row.count;
}

// Solicitudes pendientes: incoming, las que me envían (soy amigo_id); outgoing, las mías (usuario_id).
const REQUESTS_SQL = {
  incoming: `SELECT a.amistad_id, a.fecha_solicitud, ${summaryColumns("u", "other")}, u.estudios, u.curso
               FROM Amigos a JOIN Usuarios u ON u.usuario_id = a.usuario_id
              WHERE a.amigo_id = ? AND a.estado = 'pending' ORDER BY a.fecha_solicitud DESC`,
  outgoing: `SELECT a.amistad_id, a.fecha_solicitud, ${summaryColumns("u", "other")}, u.estudios, u.curso
               FROM Amigos a JOIN Usuarios u ON u.usuario_id = a.amigo_id
              WHERE a.usuario_id = ? AND a.estado = 'pending' ORDER BY a.fecha_solicitud DESC`,
};

export async function listRequests(userId) {
  const shape = (row) => ({
    _id: String(row.amistad_id),
    createdAt: row.fecha_solicitud,
    user: withStudies(row, "other"),
  });
  const [incoming, outgoing] = await Promise.all([
    sql(REQUESTS_SQL.incoming).all(userId),
    sql(REQUESTS_SQL.outgoing).all(userId),
  ]);
  return { incoming: incoming.map(shape), outgoing: outgoing.map(shape) };
}

export async function areFriends(a, b) {
  if (sameId(a, b)) return false;
  return (await findPair(a, b))?.estado === "accepted";
}

// Estado de la relación del usuario con cada id: 'self' | 'friends' | 'request_sent' | 'request_received' | 'none'
export async function relationshipMap(viewerId, userIds) {
  const rows = await sql(
    `SELECT * FROM Amigos
      WHERE (usuario_id = @me AND amigo_id = ANY(@ids::text[]))
         OR (amigo_id = @me AND usuario_id = ANY(@ids::text[]))`,
  ).all({ me: viewerId, ids: userIds.map(String) });

  const map = new Map(
    userIds.map((id) => [
      String(id),
      { status: sameId(id, viewerId) ? "self" : "none" },
    ]),
  );
  for (const row of rows) {
    const sent = sameId(row.usuario_id, viewerId);
    const other = sent ? row.amigo_id : row.usuario_id;
    if (row.estado === "accepted") map.set(other, { status: "friends" });
    else
      map.set(other, {
        status: sent ? "request_sent" : "request_received",
        requestId: String(row.amistad_id),
      });
  }
  return map;
}

async function accept(friendship, accepter) {
  await sql(
    "UPDATE Amigos SET estado = 'accepted', fecha_amistad = ? WHERE amistad_id = ?",
  ).run(nowIso(), friendship.amistad_id);

  await resolveActionable({
    type: "friend_request",
    recipient: accepter._id,
    actor: friendship.usuario_id,
  });
  await notify({
    recipients: [friendship.usuario_id],
    type: "friend_accepted",
    actor: accepter._id,
    data: { actorName: accepter.name, actorHandle: accepter.handle },
  });
}

export async function sendRequest(requester, targetId) {
  if (sameId(requester._id, targetId)) {
    throw ApiError.badRequest(
      "No puedes enviarte una solicitud a ti mismo",
      "SELF_REQUEST",
    );
  }
  if (
    !(await sql("SELECT 1 FROM Usuarios WHERE usuario_id = ?").get(targetId))
  ) {
    throw ApiError.notFound("Este estudiante no existe");
  }

  const existing = await findPair(requester._id, targetId);
  if (existing?.estado === "accepted")
    throw ApiError.conflict("Ya sois amigos", "ALREADY_FRIENDS");
  if (existing && sameId(existing.usuario_id, requester._id)) {
    throw ApiError.conflict(
      "Ya le has enviado una solicitud",
      "REQUEST_ALREADY_SENT",
    );
  }
  // Si la otra persona ya te había enviado una solicitud, enviarle otra equivale a aceptarla.
  if (existing) {
    await accept(existing, requester);
    return { status: "friends" };
  }

  const { lastInsertRowid } = await sql(
    "INSERT INTO Amigos (usuario_id, amigo_id) VALUES (?, ?) RETURNING amistad_id",
  ).run(requester._id, targetId);
  const requestId = String(lastInsertRowid);

  await notify({
    recipients: [targetId],
    type: "friend_request",
    actor: requester._id,
    data: {
      actorName: requester.name,
      actorHandle: requester.handle,
      requestId,
    },
  });
  return { status: "request_sent", requestId };
}

export async function acceptRequest(user, requestId) {
  const friendship = await sql(
    "SELECT * FROM Amigos WHERE amistad_id = ? AND amigo_id = ? AND estado = 'pending'",
  ).get(requestId, user._id);
  if (!friendship)
    throw ApiError.notFound("Esta solicitud ya no está disponible");
  await accept(friendship, user);
  return { status: "friends" };
}

// Rechazar (destinatario) o cancelar (remitente) una solicitud pendiente.
export async function deleteRequest(user, requestId) {
  const { changes } = await sql(
    "DELETE FROM Amigos WHERE amistad_id = @requestId AND estado = 'pending' AND (usuario_id = @me OR amigo_id = @me)",
  ).run({ requestId, me: user._id });
  if (changes === 0)
    throw ApiError.notFound("Esta solicitud ya no está disponible");

  await resolveActionable({ type: "friend_request", requestId });
}

export async function removeFriend(user, friendId) {
  const { changes } = await sql(
    `DELETE FROM Amigos WHERE ${PAIR_WHERE} AND estado = 'accepted'`,
  ).run(pairParams(user._id, friendId));
  if (changes === 0)
    throw ApiError.notFound("No tienes a este estudiante entre tus amigos");
}

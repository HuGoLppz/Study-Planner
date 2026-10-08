import { LIMITS } from "../config/constants.js";
import { iso, lockRow, nowIso, sql, transaction } from "../database/db.js";
import { subjectOfRoom, toRoomTask } from "../models/room.model.js";
import { summaryColumns, summaryFrom } from "../models/user.model.js";
import {
  closeRoomChannel,
  detachUserFromRoom,
  emitToRoom,
  emitToUser,
} from "../sockets/emitter.js";
import { removeRoomFiles } from "../uploads/storage.js";
import { ApiError } from "../utils/ApiError.js";
import { generatePublicId, sameId } from "../utils/ids.js";
import { areFriends } from "./friend.service.js";
import {
  notify,
  removeRoomInvitationNotice,
  resolveActionable,
} from "./notification.service.js";

const ROOM_NOT_FOUND = "Esta sala ya no existe";
const TASK_NOT_FOUND = "Esta tarea ya no existe";

const toRoom = (row) => ({
  _id: row.sala_id,
  name: row.nombre,
  description: row.descripcion,
  scheduledAt: row.fecha_sesion,
  subject: subjectOfRoom(row),
  lastActivityAt: row.ultima_actividad,
  createdAt: row.fecha_creacion,
});

const count = async (text, ...args) => (await sql(text).get(...args)).count;
const countMembers = (roomId) =>
  count(
    "SELECT COUNT(*) AS count FROM Participantes_Salas WHERE sala_id = ?",
    roomId,
  );
const countAdmins = (roomId) =>
  count(
    "SELECT COUNT(*) AS count FROM Participantes_Salas WHERE sala_id = ? AND rol = 'admin'",
    roomId,
  );
const countInvitations = (roomId) =>
  count(
    "SELECT COUNT(*) AS count FROM Invitaciones_Salas WHERE sala_id = ?",
    roomId,
  );

export async function membershipOf(roomId, userId) {
  const row = await sql(
    "SELECT rol, fecha_union FROM Participantes_Salas WHERE sala_id = ? AND usuario_id = ?",
  ).get(roomId, userId);
  return row
    ? { user: userId, role: row.rol, joinedAt: row.fecha_union }
    : null;
}

const isInvited = async (roomId, userId) =>
  Boolean(
    await sql(
      "SELECT 1 FROM Invitaciones_Salas WHERE sala_id = ? AND usuario_id = ?",
    ).get(roomId, userId),
  );

// Para el middleware loadRoom: la sala, la participación del usuario y si tiene invitación, en una consulta.
export async function getRoomAccess(roomId, userId) {
  const row = await sql(
    `SELECT s.*, p.rol, p.fecha_union,
            EXISTS (SELECT 1 FROM Invitaciones_Salas i WHERE i.sala_id = s.sala_id AND i.usuario_id = @me) AS invitado
       FROM Salas s LEFT JOIN Participantes_Salas p ON p.sala_id = s.sala_id AND p.usuario_id = @me
      WHERE s.sala_id = @roomId`,
  ).get({ roomId, me: userId });
  if (!row) return null;
  return {
    room: toRoom(row),
    membership: row.rol
      ? { user: userId, role: row.rol, joinedAt: row.fecha_union }
      : null,
    invited: row.invitado,
  };
}

export const isMember = async (roomId, userId) =>
  Boolean(await membershipOf(roomId, userId));

const touch = (roomId) =>
  sql(
    "UPDATE Salas SET ultima_actividad = ?, fecha_actualizacion = ? WHERE sala_id = ?",
  ).run(nowIso(), nowIso(), roomId);

export async function listRoomTasks(roomId) {
  const rows = await sql(
    "SELECT * FROM Tareas_Sala WHERE sala_id = ? ORDER BY tarea_sala_id",
  ).all(roomId);
  return rows.map(toRoomTask);
}

export async function getRoomDetail(roomId) {
  const [row, members, invitations, tasks] = await Promise.all([
    sql(
      `SELECT s.*, ${summaryColumns("c", "creator")}
         FROM Salas s LEFT JOIN Usuarios c ON c.usuario_id = s.creador_id
        WHERE s.sala_id = ?`,
    ).get(roomId),
    sql(
      `SELECT p.rol, p.fecha_union, ${summaryColumns("u", "member")}
         FROM Participantes_Salas p JOIN Usuarios u ON u.usuario_id = p.usuario_id
        WHERE p.sala_id = ? ORDER BY p.fecha_union, u.nombre`,
    ).all(roomId),
    sql(
      `SELECT i.invitado_por, i.fecha_invitacion, ${summaryColumns("u", "guest")}
         FROM Invitaciones_Salas i JOIN Usuarios u ON u.usuario_id = i.usuario_id
        WHERE i.sala_id = ? ORDER BY i.fecha_invitacion`,
    ).all(roomId),
    listRoomTasks(roomId),
  ]);
  if (!row) throw ApiError.notFound(ROOM_NOT_FOUND, "ROOM_NOT_FOUND");

  return {
    ...toRoom(row),
    createdBy: summaryFrom(row, "creator"),
    members: members.map((member) => ({
      user: summaryFrom(member, "member"),
      role: member.rol,
      joinedAt: member.fecha_union,
    })),
    invitations: invitations.map((invitation) => ({
      user: summaryFrom(invitation, "guest"),
      invitedBy: invitation.invitado_por,
      createdAt: invitation.fecha_invitacion,
    })),
    tasks,
    stats: { messages: row.mensajes, files: row.archivos },
  };
}

// Tras cada cambio: quien lo hace recibe la sala completa en la respuesta y el resto de
// participantes conectados solo lo que ha cambiado (`room:patch`), que aplican sobre su copia.
// `pick` elige del detalle las partes que cambian: info, members, invitations, tasks, task…
const ROOM_INFO = ({ name, description, scheduledAt, subject }) => ({
  info: { name, description, scheduledAt, subject },
});

async function broadcastRoom(roomId, pick) {
  const detail = await getRoomDetail(roomId);
  emitToRoom(roomId, "room:patch", {
    roomId,
    lastActivityAt: detail.lastActivityAt,
    stats: detail.stats,
    ...pick(detail),
  });
  return detail;
}

const taskPatch = (taskId) => (detail) => ({
  task: detail.tasks.find((task) => task._id === String(taskId)),
});

// Salas del usuario por actividad reciente. Con `limit` (dashboard) solo se leen las primeras.
export async function listRooms(userId, { limit = null } = {}) {
  const rows = await sql(
    `SELECT s.*, p.rol AS mi_rol,
            (SELECT COUNT(*) FROM Participantes_Salas x WHERE x.sala_id = s.sala_id) AS participantes,
            (SELECT COUNT(*) FROM Tareas_Sala t WHERE t.sala_id = s.sala_id AND t.estado <> 'completed'
                                                  AND t.usuario_id = @me) AS mis_abiertas
       FROM Salas s JOIN Participantes_Salas p ON p.sala_id = s.sala_id AND p.usuario_id = @me
      ORDER BY s.ultima_actividad DESC
      LIMIT @limit`,
  ).all({ me: userId, limit });

  // Los cinco primeros participantes de cada sala, en una sola consulta.
  const faces = await sql(
    `SELECT sala_id, ${summaryColumns("u", "member")}
       FROM (SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.sala_id ORDER BY p.fecha_union) AS orden
               FROM Participantes_Salas p
              WHERE p.sala_id = ANY(@rooms::text[])) p
       JOIN Usuarios u ON u.usuario_id = p.usuario_id
      WHERE p.orden <= 5
      ORDER BY p.sala_id, p.orden`,
  ).all({ rooms: rows.map((row) => row.sala_id) });
  const facesByRoom = new Map();
  for (const face of faces)
    facesByRoom.set(face.sala_id, [
      ...(facesByRoom.get(face.sala_id) ?? []),
      face,
    ]);

  return rows.map((row) => ({
    ...toRoom(row),
    stats: { messages: row.mensajes, files: row.archivos },
    myRole: row.mi_rol,
    memberCount: row.participantes,
    members: (facesByRoom.get(row.sala_id) ?? []).map((face) =>
      summaryFrom(face, "member"),
    ),
    openTasks: row.tareas_abiertas,
    myOpenTasks: row.mis_abiertas,
  }));
}

export const countUserRooms = (userId) =>
  count(
    "SELECT COUNT(*) AS count FROM Participantes_Salas WHERE usuario_id = ?",
    userId,
  );

export const countUserInvitations = (userId) =>
  count(
    "SELECT COUNT(*) AS count FROM Invitaciones_Salas WHERE usuario_id = ?",
    userId,
  );

export async function listInvitations(userId) {
  const rows = await sql(
    `SELECT s.*, i.fecha_invitacion, ${summaryColumns("u", "inviter")},
            (SELECT COUNT(*) FROM Participantes_Salas x WHERE x.sala_id = s.sala_id) AS participantes
       FROM Invitaciones_Salas i
       JOIN Salas s ON s.sala_id = i.sala_id
       JOIN Usuarios u ON u.usuario_id = i.invitado_por
      WHERE i.usuario_id = ?
      ORDER BY i.fecha_invitacion DESC`,
  ).all(userId);
  return rows.map((row) => ({
    room: {
      _id: row.sala_id,
      name: row.nombre,
      description: row.descripcion,
      subject: subjectOfRoom(row),
      scheduledAt: row.fecha_sesion,
      memberCount: row.participantes,
    },
    invitedBy: summaryFrom(row, "inviter"),
    createdAt: row.fecha_invitacion,
  }));
}

// Sesiones programadas y tareas de sala asignadas al usuario dentro de un rango de fechas.
export async function getAgenda(userId, { from, to }) {
  const params = { me: userId, from: iso(from), to: iso(to) };

  const [sessionRows, taskRows] = await Promise.all([
    sql(
      `SELECT s.* FROM Salas s JOIN Participantes_Salas p ON p.sala_id = s.sala_id AND p.usuario_id = @me
        WHERE s.fecha_sesion BETWEEN @from AND @to`,
    ).all(params),
    sql(
      `SELECT t.*, s.nombre AS sala_nombre, s.asignatura_nombre, s.asignatura_color
         FROM Tareas_Sala t JOIN Salas s ON s.sala_id = t.sala_id
        WHERE t.usuario_id = @me AND t.fecha_entrega BETWEEN @from AND @to`,
    ).all(params),
  ]);

  const sessions = sessionRows.map((row) => ({
    roomId: row.sala_id,
    roomName: row.nombre,
    subject: subjectOfRoom(row),
    kind: "session",
    _id: `session-${row.sala_id}`,
    title: row.nombre,
    date: row.fecha_sesion,
  }));
  const tasks = taskRows.map((row) => ({
    roomId: row.sala_id,
    roomName: row.sala_nombre,
    subject: subjectOfRoom(row),
    kind: "room_task",
    _id: `task-${row.tarea_sala_id}`,
    taskId: String(row.tarea_sala_id),
    title: row.titulo,
    date: row.fecha_entrega,
    status: row.estado,
  }));

  return [...sessions, ...tasks].sort((a, b) => a.date.localeCompare(b.date));
}

// Las asignaturas son privadas: la sala guarda una copia del nombre y el color.
function subjectSnapshot(user, subjectId) {
  if (!subjectId) return { name: null, color: null };
  const subject = user.subjects.find((item) => sameId(item._id, subjectId));
  if (!subject)
    throw ApiError.unprocessable("La asignatura no existe", {
      subjectId: "Elige una de tus asignaturas",
    });
  return { name: subject.name, color: subject.color };
}

export async function createRoom(
  user,
  { name, description, subjectId, scheduledAt },
) {
  const subject = subjectSnapshot(user, subjectId);
  const roomId = generatePublicId();

  await transaction(async () => {
    await sql(
      `INSERT INTO Salas (sala_id, nombre, descripcion, fecha_sesion, asignatura_nombre, asignatura_color, creador_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      roomId,
      name,
      description,
      iso(scheduledAt),
      subject.name,
      subject.color,
      user._id,
    );
    await sql(
      "INSERT INTO Participantes_Salas (sala_id, usuario_id, rol) VALUES (?, ?, 'admin')",
    ).run(roomId, user._id);
  });
  return getRoomDetail(roomId);
}

export async function updateRoom(room, user, data) {
  const set = { ultima_actividad: nowIso(), fecha_actualizacion: nowIso() };
  if (data.name !== undefined) set.nombre = data.name;
  if (data.description !== undefined) set.descripcion = data.description;
  if (data.scheduledAt !== undefined) set.fecha_sesion = iso(data.scheduledAt);
  if (data.subjectId !== undefined) {
    const subject = subjectSnapshot(user, data.subjectId);
    set.asignatura_nombre = subject.name;
    set.asignatura_color = subject.color;
  }

  const assignments = Object.keys(set)
    .map((column) => `${column} = @${column}`)
    .join(", ");
  await sql(`UPDATE Salas SET ${assignments} WHERE sala_id = @roomId`).run({
    ...set,
    roomId: room._id,
  });
  return broadcastRoom(room._id, ROOM_INFO);
}

// ON DELETE CASCADE borra participantes, invitaciones, tareas, mensajes, archivos y avisos.
export async function deleteRoom(room) {
  await sql("DELETE FROM Salas WHERE sala_id = ?").run(room._id);
  await removeRoomFiles(room._id);

  emitToRoom(room._id, "room:deleted", { roomId: room._id });
  closeRoomChannel(room._id);
}

// Las operaciones que comprueban una regla de la sala y después escriben empiezan bloqueando la
// fila de la sala (lockRow): dos peticiones a la vez sobre la misma sala no pueden saltarse los
// límites ni dejarla sin administradores.

export async function inviteFriends(room, inviter, userIds) {
  const ids = [...new Set(userIds.map(String))].filter(
    (id) => !sameId(id, inviter._id),
  );
  const flags = await Promise.all(
    ids.map(async (id) => ({
      id,
      taken: (await isMember(room._id, id)) || (await isInvited(room._id, id)),
      friend: await areFriends(inviter._id, id),
    })),
  );
  const candidates = flags.filter((flag) => !flag.taken);
  if (candidates.length === 0) {
    throw ApiError.conflict(
      "Esas personas ya están en la sala o tienen una invitación pendiente",
      "ALREADY_INVITED",
    );
  }
  const invitable = candidates
    .filter((flag) => flag.friend)
    .map((flag) => flag.id);
  if (invitable.length === 0)
    throw ApiError.unprocessable("Solo puedes invitar a tus amigos", {
      userIds: "Elige amigos tuyos",
    });

  await transaction(async () => {
    await lockRow("sala", room._id);
    const [members, invitations] = await Promise.all([
      countMembers(room._id),
      countInvitations(room._id),
    ]);
    if (members + invitations + invitable.length > LIMITS.membersPerRoom) {
      throw ApiError.conflict(
        `Una sala admite como máximo ${LIMITS.membersPerRoom} personas`,
        "ROOM_FULL",
      );
    }
    await sql(
      `INSERT INTO Invitaciones_Salas (sala_id, usuario_id, invitado_por)
       SELECT @roomId, invitado, @inviter FROM unnest(@users::text[]) AS invitado`,
    ).run({ roomId: room._id, inviter: inviter._id, users: invitable });
  });

  await notify({
    recipients: invitable,
    type: "room_invitation",
    actor: inviter._id,
    room: room._id,
    data: { actorName: inviter.name, roomName: room.name },
  });
  return broadcastRoom(room._id, ({ invitations }) => ({ invitations }));
}

export async function acceptInvitation(roomId, user) {
  // De invitado a participante en una sola transacción, solo si queda sitio.
  await transaction(async () => {
    await lockRow("sala", roomId);
    if (!(await isInvited(roomId, user._id))) {
      throw ApiError.notFound(
        "Esta invitación ya no está disponible",
        "INVITATION_NOT_FOUND",
      );
    }
    if ((await countMembers(roomId)) >= LIMITS.membersPerRoom)
      throw ApiError.conflict("La sala está completa", "ROOM_FULL");

    await sql(
      "DELETE FROM Invitaciones_Salas WHERE sala_id = ? AND usuario_id = ?",
    ).run(roomId, user._id);
    await sql(
      "INSERT INTO Participantes_Salas (sala_id, usuario_id, rol) VALUES (?, ?, 'member')",
    ).run(roomId, user._id);
    await touch(roomId);
  });

  const [{ nombre: roomName }, admins] = await Promise.all([
    sql("SELECT nombre FROM Salas WHERE sala_id = ?").get(roomId),
    sql(
      "SELECT usuario_id FROM Participantes_Salas WHERE sala_id = ? AND rol = 'admin'",
    ).all(roomId),
  ]);

  await resolveActionable({
    type: "room_invitation",
    recipient: user._id,
    room: roomId,
  });
  await notify({
    recipients: admins.map((row) => row.usuario_id),
    type: "room_member_joined",
    actor: user._id,
    room: roomId,
    data: { actorName: user.name, roomName },
  });
  return broadcastRoom(roomId, ({ members, invitations }) => ({
    members,
    invitations,
  }));
}

export async function declineInvitation(roomId, user) {
  const { changes } = await sql(
    "DELETE FROM Invitaciones_Salas WHERE sala_id = ? AND usuario_id = ?",
  ).run(roomId, user._id);
  if (changes === 0)
    throw ApiError.notFound(
      "Esta invitación ya no está disponible",
      "INVITATION_NOT_FOUND",
    );

  await resolveActionable({
    type: "room_invitation",
    recipient: user._id,
    room: roomId,
  });
  await broadcastRoom(roomId, ({ invitations }) => ({ invitations }));
}

export async function cancelInvitation(room, userId) {
  const { changes } = await sql(
    "DELETE FROM Invitaciones_Salas WHERE sala_id = ? AND usuario_id = ?",
  ).run(room._id, userId);
  if (changes === 0)
    throw ApiError.notFound("Esa persona no tiene una invitación pendiente");

  await removeRoomInvitationNotice(userId, room._id);
  return broadcastRoom(room._id, ({ invitations }) => ({ invitations }));
}

export async function updateMemberRole(room, actor, userId, role) {
  const changed = await transaction(async () => {
    await lockRow("sala", room._id);
    const target = await membershipOf(room._id, userId);
    if (!target)
      throw ApiError.notFound("Esa persona no forma parte de la sala");
    if (target.role === role) return false;
    // La sala conserva al menos una persona administradora.
    if (role === "member" && (await countAdmins(room._id)) <= 1) {
      throw ApiError.conflict(
        "La sala necesita al menos una persona administradora",
        "LAST_ADMIN",
      );
    }
    await sql(
      "UPDATE Participantes_Salas SET rol = ? WHERE sala_id = ? AND usuario_id = ?",
    ).run(role, room._id, userId);
    return true;
  });
  if (!changed) return getRoomDetail(room._id);

  if (role === "admin") {
    await notify({
      recipients: [userId],
      type: "room_role_changed",
      actor: actor._id,
      room: room._id,
      data: { actorName: actor.name, roomName: room.name, role },
    });
  }
  return broadcastRoom(room._id, ({ members }) => ({ members }));
}

// Expulsar (administradores) o salir (uno mismo). Las tareas de esa persona quedan sin asignar
// (trigger tr_participantes_salida_desasigna).
export async function removeMember(room, actor, actorMembership, userId) {
  const isSelf = sameId(actor._id, userId);
  if (!isSelf && actorMembership.role !== "admin") {
    throw ApiError.forbidden(
      "Solo los administradores pueden quitar participantes",
      "ROOM_ADMIN_REQUIRED",
    );
  }

  await transaction(async () => {
    await lockRow("sala", room._id);
    const target = await membershipOf(room._id, userId);
    if (!target)
      throw ApiError.notFound("Esa persona no forma parte de la sala");
    if ((await countMembers(room._id)) === 1) {
      throw ApiError.conflict(
        "Eres la única persona en la sala. Si ya no la necesitas, elimínala.",
        "LAST_MEMBER",
      );
    }
    if (target.role === "admin" && (await countAdmins(room._id)) <= 1) {
      throw ApiError.conflict(
        "Nombra a otra persona administradora antes de salir",
        "LAST_ADMIN",
      );
    }
    await sql(
      "DELETE FROM Participantes_Salas WHERE sala_id = ? AND usuario_id = ?",
    ).run(room._id, userId);
    await touch(room._id);
  });

  detachUserFromRoom(userId, room._id);
  if (!isSelf)
    emitToUser(userId, "room:removed", {
      roomId: room._id,
      roomName: room.name,
    });
  return broadcastRoom(room._id, ({ members, tasks }) => ({ members, tasks }));
}

async function findRoomTask(roomId, taskId) {
  const row = await sql(
    "SELECT * FROM Tareas_Sala WHERE tarea_sala_id = ? AND sala_id = ?",
  ).get(taskId, roomId);
  if (!row) throw ApiError.notFound(TASK_NOT_FOUND);
  return toRoomTask(row);
}

async function assertAssignable(roomId, assigneeId) {
  if (assigneeId && !(await isMember(roomId, assigneeId))) {
    throw ApiError.unprocessable("Esa persona no está en la sala", {
      assigneeId: "Elige a alguien de la sala",
    });
  }
}

async function notifyAssignment(room, actor, assigneeId, task) {
  if (!assigneeId || sameId(assigneeId, actor._id)) return;
  await notify({
    recipients: [assigneeId],
    type: "room_task_assigned",
    actor: actor._id,
    room: room._id,
    task: task._id,
    data: { actorName: actor.name, roomName: room.name, taskTitle: task.title },
  });
}

const completedAtFor = (status) => (status === "completed" ? nowIso() : null);

export async function createRoomTask(
  room,
  actor,
  { title, description, dueDate, assigneeId, status },
) {
  await assertAssignable(room._id, assigneeId);

  const taskId = await transaction(async () => {
    await lockRow("sala", room._id);
    if (
      (await count(
        "SELECT COUNT(*) AS count FROM Tareas_Sala WHERE sala_id = ?",
        room._id,
      )) >= LIMITS.tasksPerRoom
    ) {
      throw ApiError.conflict(
        `Una sala admite como máximo ${LIMITS.tasksPerRoom} tareas`,
        "ROOM_TASK_LIMIT",
      );
    }
    const { lastInsertRowid } = await sql(
      `INSERT INTO Tareas_Sala (sala_id, usuario_id, creador_id, titulo, descripcion, fecha_entrega, estado, fecha_completada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING tarea_sala_id`,
    ).run(
      room._id,
      assigneeId,
      actor._id,
      title,
      description,
      iso(dueDate),
      status,
      completedAtFor(status),
    );
    await touch(room._id);
    return lastInsertRowid;
  });

  await notifyAssignment(room, actor, assigneeId, { _id: taskId, title });
  return broadcastRoom(room._id, taskPatch(taskId));
}

export async function updateRoomTask(room, actor, taskId, data) {
  const task = await findRoomTask(room._id, taskId);
  if (data.assigneeId !== undefined)
    await assertAssignable(room._id, data.assigneeId);

  const set = { fecha_actualizacion: nowIso() };
  if (data.title !== undefined) set.titulo = data.title;
  if (data.description !== undefined) set.descripcion = data.description;
  if (data.dueDate !== undefined) set.fecha_entrega = iso(data.dueDate);
  if (data.assigneeId !== undefined) set.usuario_id = data.assigneeId;
  if (data.status && data.status !== task.status) {
    set.estado = data.status;
    set.fecha_completada = completedAtFor(data.status);
  }

  const assignments = Object.keys(set)
    .map((column) => `${column} = @${column}`)
    .join(", ");
  await transaction(async () => {
    await sql(
      `UPDATE Tareas_Sala SET ${assignments} WHERE tarea_sala_id = @taskId`,
    ).run({ ...set, taskId });
    await touch(room._id);
  });

  if (data.assigneeId && !sameId(data.assigneeId, task.assignee)) {
    await notifyAssignment(room, actor, data.assigneeId, {
      _id: task._id,
      title: data.title ?? task.title,
    });
  }
  return broadcastRoom(room._id, taskPatch(taskId));
}

export async function deleteRoomTask(room, actor, membership, taskId) {
  const task = await findRoomTask(room._id, taskId);
  if (!sameId(task.createdBy, actor._id) && membership.role !== "admin") {
    throw ApiError.forbidden(
      "Solo quien creó la tarea o un administrador puede eliminarla",
    );
  }

  await transaction(async () => {
    await sql("DELETE FROM Tareas_Sala WHERE tarea_sala_id = ?").run(taskId);
    await touch(room._id);
  });
  return broadcastRoom(room._id, () => ({ deletedTaskId: String(taskId) }));
}

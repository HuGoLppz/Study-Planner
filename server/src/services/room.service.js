import { LIMITS, USER_SUMMARY_FIELDS } from '../config/constants.js';
import { Friendship } from '../models/Friendship.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';
import { Room } from '../models/Room.js';
import { RoomFile } from '../models/RoomFile.js';
import { serializeUserSummary } from '../serializers/user.serializer.js';
import { closeRoomChannel, detachUserFromRoom, emitToRoom, emitToUser } from '../sockets/emitter.js';
import { paths, removeDirectory } from '../uploads/storage.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';
import { notify, resolveActionable } from './notification.service.js';

// Condición atómica: la sala conserva al menos dos administradores antes de quitar uno.
const HAS_SPARE_ADMIN = {
  $expr: {
    $gt: [{ $size: { $filter: { input: '$members', cond: { $eq: ['$$this.role', 'admin'] } } } }, 1],
  },
};

const summary = (user) => (user?.name ? serializeUserSummary(user) : { _id: user?._id ?? user, name: null });

function subjectSnapshot(user, subjectId) {
  if (!subjectId) return null;
  const subject = user.subjects.id(subjectId);
  if (!subject) throw ApiError.unprocessable('La asignatura no existe', { subjectId: 'Elige una de tus asignaturas' });
  return { name: subject.name, color: subject.color };
}

export function serializeRoom(room) {
  return {
    _id: room._id,
    name: room.name,
    description: room.description,
    scheduledAt: room.scheduledAt,
    subject: room.subject,
    createdBy: summary(room.createdBy),
    members: room.members.map((member) => ({ user: summary(member.user), role: member.role, joinedAt: member.joinedAt })),
    invitations: room.invitations.map((invitation) => ({
      user: summary(invitation.user),
      invitedBy: invitation.invitedBy,
      createdAt: invitation.createdAt,
    })),
    tasks: room.tasks.map((task) => task.toObject()),
    stats: room.stats,
    lastActivityAt: room.lastActivityAt,
    createdAt: room.createdAt,
  };
}

export async function getRoomDetail(roomId) {
  const room = await Room.findById(roomId).populate([
    { path: 'members.user', select: USER_SUMMARY_FIELDS },
    { path: 'invitations.user', select: USER_SUMMARY_FIELDS },
    { path: 'createdBy', select: USER_SUMMARY_FIELDS },
  ]);
  if (!room) throw ApiError.notFound('Esta sala ya no existe', 'ROOM_NOT_FOUND');
  return serializeRoom(room);
}

// Tras cada cambio, todos los participantes conectados reciben la sala actualizada.
async function broadcastRoom(roomId) {
  const detail = await getRoomDetail(roomId);
  emitToRoom(roomId, 'room:updated', detail);
  return detail;
}

const touch = () => ({ lastActivityAt: new Date() });

export async function listRooms(userId) {
  const rooms = await Room.find({ 'members.user': userId })
    .sort({ lastActivityAt: -1 })
    .populate('members.user', USER_SUMMARY_FIELDS);

  return rooms.map((room) => {
    const openTasks = room.tasks.filter((task) => task.status !== 'completed');
    return {
      _id: room._id,
      name: room.name,
      description: room.description,
      subject: room.subject,
      scheduledAt: room.scheduledAt,
      lastActivityAt: room.lastActivityAt,
      stats: room.stats,
      myRole: room.membershipOf(userId)?.role,
      memberCount: room.members.length,
      members: room.members.slice(0, 5).map((member) => summary(member.user)),
      openTasks: openTasks.length,
      myOpenTasks: openTasks.filter((task) => sameId(task.assignee, userId)).length,
    };
  });
}

export async function listInvitations(userId) {
  const rooms = await Room.find({ 'invitations.user': userId })
    .sort({ updatedAt: -1 })
    .populate('invitations.invitedBy', USER_SUMMARY_FIELDS);

  return rooms.map((room) => {
    const invitation = room.invitations.find((item) => sameId(item.user, userId));
    return {
      room: {
        _id: room._id,
        name: room.name,
        description: room.description,
        subject: room.subject,
        scheduledAt: room.scheduledAt,
        memberCount: room.members.length,
      },
      invitedBy: summary(invitation.invitedBy),
      createdAt: invitation.createdAt,
    };
  });
}

// Sesiones programadas y tareas de sala asignadas al usuario dentro de un rango de fechas.
export async function getAgenda(userId, { from, to }) {
  const rooms = await Room.find({
    'members.user': userId,
    $or: [
      { scheduledAt: { $gte: from, $lte: to } },
      { tasks: { $elemMatch: { assignee: userId, dueDate: { $gte: from, $lte: to } } } },
    ],
  }).select('name subject scheduledAt tasks');

  const events = [];
  for (const room of rooms) {
    const base = { roomId: room._id, roomName: room.name, subject: room.subject };
    if (room.scheduledAt && room.scheduledAt >= from && room.scheduledAt <= to) {
      events.push({ ...base, kind: 'session', _id: `session-${room._id}`, title: room.name, date: room.scheduledAt });
    }
    for (const task of room.tasks) {
      if (sameId(task.assignee, userId) && task.dueDate && task.dueDate >= from && task.dueDate <= to) {
        events.push({
          ...base,
          kind: 'room_task',
          _id: `task-${task._id}`,
          taskId: task._id,
          title: task.title,
          date: task.dueDate,
          status: task.status,
        });
      }
    }
  }
  return events.sort((a, b) => a.date - b.date);
}

export async function createRoom(user, { name, description, subjectId, scheduledAt }) {
  const room = await Room.create({
    name,
    description,
    scheduledAt,
    subject: subjectSnapshot(user, subjectId),
    createdBy: user._id,
    members: [{ user: user._id, role: 'admin' }],
  });
  return getRoomDetail(room._id);
}

export async function updateRoom(room, user, data) {
  const update = { ...touch() };
  for (const field of ['name', 'description', 'scheduledAt']) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  if (data.subjectId !== undefined) update.subject = subjectSnapshot(user, data.subjectId);

  await Room.updateOne({ _id: room._id }, { $set: update });
  return broadcastRoom(room._id);
}

export async function deleteRoom(room) {
  const roomId = room._id;
  await Promise.all([
    Message.deleteMany({ room: roomId }),
    RoomFile.deleteMany({ room: roomId }),
    Notification.deleteMany({ room: roomId }),
  ]);
  await Room.deleteOne({ _id: roomId });
  await removeDirectory(paths.room(roomId));

  emitToRoom(roomId, 'room:deleted', { roomId });
  closeRoomChannel(roomId);
}

export async function inviteFriends(room, inviter, userIds) {
  const candidates = [...new Set(userIds.map(String))].filter(
    (id) => !room.membershipOf(id) && !room.isInvited(id) && !sameId(id, inviter._id),
  );
  if (candidates.length === 0) {
    throw ApiError.conflict('Esas personas ya están en la sala o tienen una invitación pendiente', 'ALREADY_INVITED');
  }

  const friendships = await Friendship.find({
    pairKey: { $in: candidates.map((id) => Friendship.pairKeyFor(inviter._id, id)) },
    status: 'accepted',
  });
  const friendIds = new Set(friendships.flatMap((friendship) => friendship.users.map(String)));
  const invitable = candidates.filter((id) => friendIds.has(id));

  if (invitable.length === 0) throw ApiError.unprocessable('Solo puedes invitar a tus amigos', { userIds: 'Elige amigos tuyos' });
  if (room.members.length + room.invitations.length + invitable.length > LIMITS.membersPerRoom) {
    throw ApiError.conflict(`Una sala admite como máximo ${LIMITS.membersPerRoom} personas`, 'ROOM_FULL');
  }

  const now = new Date();
  const result = await Room.updateOne(
    { _id: room._id, 'invitations.user': { $nin: invitable }, 'members.user': { $nin: invitable } },
    { $push: { invitations: { $each: invitable.map((id) => ({ user: id, invitedBy: inviter._id, createdAt: now })) } } },
  );
  if (result.modifiedCount === 0) {
    throw ApiError.conflict('La sala ha cambiado mientras invitabas. Vuelve a intentarlo.', 'ROOM_CHANGED');
  }

  await notify({
    recipients: invitable,
    type: 'room_invitation',
    actor: inviter._id,
    room: room._id,
    data: { actorName: inviter.name, roomName: room.name },
  });
  return broadcastRoom(room._id);
}

export async function acceptInvitation(roomId, user) {
  const now = new Date();
  // Paso atómico de invitado a participante, solo si queda sitio.
  const room = await Room.findOneAndUpdate(
    {
      _id: roomId,
      'invitations.user': user._id,
      'members.user': { $ne: user._id },
      [`members.${LIMITS.membersPerRoom - 1}`]: { $exists: false },
    },
    {
      $pull: { invitations: { user: user._id } },
      $push: { members: { user: user._id, role: 'member', joinedAt: now } },
      $set: { lastActivityAt: now },
    },
    { new: true },
  );

  if (!room) {
    const stillInvited = await Room.exists({ _id: roomId, 'invitations.user': user._id });
    if (stillInvited) throw ApiError.conflict('La sala está completa', 'ROOM_FULL');
    throw ApiError.notFound('Esta invitación ya no está disponible', 'INVITATION_NOT_FOUND');
  }

  const admins = room.members.filter((member) => member.role === 'admin').map((member) => member.user);
  await Promise.all([
    resolveActionable({ recipient: user._id, type: 'room_invitation', room: room._id }),
    notify({
      recipients: admins,
      type: 'room_member_joined',
      actor: user._id,
      room: room._id,
      data: { actorName: user.name, roomName: room.name },
    }),
  ]);
  return broadcastRoom(room._id);
}

export async function declineInvitation(roomId, user) {
  const result = await Room.updateOne(
    { _id: roomId, 'invitations.user': user._id },
    { $pull: { invitations: { user: user._id } } },
  );
  if (result.modifiedCount === 0) throw ApiError.notFound('Esta invitación ya no está disponible', 'INVITATION_NOT_FOUND');

  await resolveActionable({ recipient: user._id, type: 'room_invitation', room: roomId });
  await broadcastRoom(roomId);
}

export async function cancelInvitation(room, userId) {
  const result = await Room.updateOne({ _id: room._id }, { $pull: { invitations: { user: userId } } });
  if (result.modifiedCount === 0) throw ApiError.notFound('Esa persona no tiene una invitación pendiente');

  await Notification.deleteMany({ recipient: userId, type: 'room_invitation', room: room._id, read: false });
  return broadcastRoom(room._id);
}

export async function updateMemberRole(room, actor, userId, role) {
  const target = room.membershipOf(userId);
  if (!target) throw ApiError.notFound('Esa persona no forma parte de la sala');
  if (target.role === role) return getRoomDetail(room._id);

  const filter = { _id: room._id, 'members.user': userId, ...(role === 'member' ? HAS_SPARE_ADMIN : {}) };
  const result = await Room.updateOne(filter, { $set: { 'members.$.role': role } });
  if (result.modifiedCount === 0) {
    throw ApiError.conflict('La sala necesita al menos una persona administradora', 'LAST_ADMIN');
  }

  if (role === 'admin') {
    await notify({
      recipients: [userId],
      type: 'room_role_changed',
      actor: actor._id,
      room: room._id,
      data: { actorName: actor.name, roomName: room.name, role },
    });
  }
  return broadcastRoom(room._id);
}

// Expulsar (administradores) o salir (uno mismo). Las tareas de esa persona quedan sin asignar.
export async function removeMember(room, actor, actorMembership, userId) {
  const isSelf = sameId(actor._id, userId);
  if (!isSelf && actorMembership.role !== 'admin') {
    throw ApiError.forbidden('Solo los administradores pueden quitar participantes', 'ROOM_ADMIN_REQUIRED');
  }

  const target = room.membershipOf(userId);
  if (!target) throw ApiError.notFound('Esa persona no forma parte de la sala');
  if (room.members.length === 1) {
    throw ApiError.conflict('Eres la única persona en la sala. Si ya no la necesitas, elimínala.', 'LAST_MEMBER');
  }

  const filter = { _id: room._id, 'members.user': userId, ...(target.role === 'admin' ? HAS_SPARE_ADMIN : {}) };
  const result = await Room.updateOne(
    filter,
    { $pull: { members: { user: userId } }, $set: { 'tasks.$[assigned].assignee': null, ...touch() } },
    { arrayFilters: [{ 'assigned.assignee': userId }] },
  );
  if (result.modifiedCount === 0) {
    throw ApiError.conflict('Nombra a otra persona administradora antes de salir', 'LAST_ADMIN');
  }

  detachUserFromRoom(userId, room._id);
  if (!isSelf) emitToUser(userId, 'room:removed', { roomId: room._id, roomName: room.name });
  return broadcastRoom(room._id);
}

function assertAssignable(room, assigneeId) {
  if (assigneeId && !room.membershipOf(assigneeId)) {
    throw ApiError.unprocessable('Esa persona no está en la sala', { assigneeId: 'Elige a alguien de la sala' });
  }
}

async function notifyAssignment(room, actor, assigneeId, task) {
  if (!assigneeId || sameId(assigneeId, actor._id)) return;
  await notify({
    recipients: [assigneeId],
    type: 'room_task_assigned',
    actor: actor._id,
    room: room._id,
    task: task._id,
    data: { actorName: actor.name, roomName: room.name, taskTitle: task.title },
  });
}

export async function createRoomTask(room, actor, { assigneeId, status, ...data }) {
  assertAssignable(room, assigneeId);

  const updated = await Room.findOneAndUpdate(
    { _id: room._id, [`tasks.${LIMITS.tasksPerRoom - 1}`]: { $exists: false } },
    {
      $push: {
        tasks: {
          ...data,
          status,
          assignee: assigneeId,
          createdBy: actor._id,
          completedAt: status === 'completed' ? new Date() : null,
        },
      },
      $set: touch(),
    },
    { new: true },
  );
  if (!updated) throw ApiError.conflict(`Una sala admite como máximo ${LIMITS.tasksPerRoom} tareas`, 'ROOM_TASK_LIMIT');

  await notifyAssignment(room, actor, assigneeId, updated.tasks.at(-1));
  return broadcastRoom(room._id);
}

export async function updateRoomTask(room, actor, taskId, { assigneeId, status, ...data }) {
  const task = room.tasks.id(taskId);
  if (!task) throw ApiError.notFound('Esta tarea ya no existe');
  if (assigneeId !== undefined) assertAssignable(room, assigneeId);

  const set = { ...touch() };
  for (const [field, value] of Object.entries(data)) {
    if (value !== undefined) set[`tasks.$.${field}`] = value;
  }
  if (assigneeId !== undefined) set['tasks.$.assignee'] = assigneeId;
  if (status && status !== task.status) {
    set['tasks.$.status'] = status;
    set['tasks.$.completedAt'] = status === 'completed' ? new Date() : null;
  }
  set['tasks.$.updatedAt'] = new Date();

  await Room.updateOne({ _id: room._id, 'tasks._id': taskId }, { $set: set });

  if (assigneeId && !sameId(assigneeId, task.assignee)) {
    await notifyAssignment(room, actor, assigneeId, { _id: task._id, title: data.title ?? task.title });
  }
  return broadcastRoom(room._id);
}

export async function deleteRoomTask(room, actor, membership, taskId) {
  const task = room.tasks.id(taskId);
  if (!task) throw ApiError.notFound('Esta tarea ya no existe');
  if (!sameId(task.createdBy, actor._id) && membership.role !== 'admin') {
    throw ApiError.forbidden('Solo quien creó la tarea o un administrador puede eliminarla');
  }

  await Room.updateOne({ _id: room._id }, { $pull: { tasks: { _id: taskId } }, $set: touch() });
  return broadcastRoom(room._id);
}

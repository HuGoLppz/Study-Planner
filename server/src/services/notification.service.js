import { USER_SUMMARY_FIELDS } from '../config/constants.js';
import { Notification } from '../models/Notification.js';
import { serializeUserSummary } from '../serializers/user.serializer.js';
import { emitToUser } from '../sockets/emitter.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';
import { logger } from '../utils/logger.js';

function serialize(notification) {
  const plain = notification.toObject ? notification.toObject() : notification;
  return { ...plain, actor: plain.actor?.name ? serializeUserSummary(plain.actor) : null };
}

// Las notificaciones nunca deben romper la operación que las origina: los errores se registran.
export async function notify({ recipients, type, actor = null, room = null, task = null, data = {} }) {
  const targets = [...new Set(recipients.map(String))].filter((id) => !sameId(id, actor));
  if (targets.length === 0) return [];

  try {
    const created = await Notification.insertMany(
      targets.map((recipient) => ({ recipient, type, actor, room, task, data })),
    );
    const populated = await Notification.populate(created, { path: 'actor', select: USER_SUMMARY_FIELDS });
    populated.forEach((notification) => emitToUser(notification.recipient, 'notification:new', serialize(notification)));
    return populated;
  } catch (error) {
    logger.error('No se pudo crear la notificación', error);
    return [];
  }
}

export async function listNotifications(userId, { unread, before, limit }) {
  const filter = { recipient: userId };
  if (unread !== undefined) filter.read = !unread;
  if (before) filter._id = { $lt: before };

  const items = await Notification.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('actor', USER_SUMMARY_FIELDS);

  const hasMore = items.length > limit;
  const page = items.slice(0, limit).map(serialize);
  return { items: page, nextCursor: hasMore ? page.at(-1)._id : null };
}

export function countUnread(userId) {
  return Notification.countDocuments({ recipient: userId, read: false });
}

export async function setRead(userId, notificationId, read) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { read, readAt: read ? new Date() : null } },
    { new: true },
  ).populate('actor', USER_SUMMARY_FIELDS);

  if (!notification) throw ApiError.notFound('Esta notificación ya no existe');
  return serialize(notification);
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function removeNotification(userId, notificationId) {
  const result = await Notification.deleteOne({ _id: notificationId, recipient: userId });
  if (result.deletedCount === 0) throw ApiError.notFound('Esta notificación ya no existe');
}

// Cuando una solicitud o invitación se resuelve por otra vía, su aviso deja de pedir acción.
export async function resolveActionable(filter) {
  await Notification.updateMany({ ...filter, read: false }, { $set: { read: true, readAt: new Date() } });
}

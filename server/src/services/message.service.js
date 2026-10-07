import { USER_SUMMARY_FIELDS } from '../config/constants.js';
import { Message } from '../models/Message.js';
import { Room } from '../models/Room.js';
import { serializeUserSummary } from '../serializers/user.serializer.js';
import { emitToRoom } from '../sockets/emitter.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';

function serialize(message) {
  return {
    _id: message._id,
    room: message.room,
    author: message.author?.name ? serializeUserSummary(message.author) : { _id: message.author, name: null },
    body: message.body,
    editedAt: message.editedAt,
    createdAt: message.createdAt,
  };
}

// Historial paginado hacia atrás con cursor sobre _id. Se devuelve en orden cronológico.
export async function listMessages(roomId, { before, limit }) {
  const filter = { room: roomId, ...(before ? { _id: { $lt: before } } : {}) };
  const items = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', USER_SUMMARY_FIELDS);

  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  return { items: page.reverse().map(serialize), nextCursor: hasMore ? page[0]._id : null };
}

export async function createMessage(room, author, body) {
  const message = await Message.create({ room: room._id, author: author._id, body });
  await Room.updateOne({ _id: room._id }, { $inc: { 'stats.messages': 1 }, $set: { lastActivityAt: message.createdAt } });

  await message.populate('author', USER_SUMMARY_FIELDS);
  const payload = serialize(message);
  emitToRoom(room._id, 'message:new', payload);
  return payload;
}

async function findInRoom(roomId, messageId) {
  const message = await Message.findOne({ _id: messageId, room: roomId });
  if (!message) throw ApiError.notFound('Este mensaje ya no existe');
  return message;
}

export async function updateMessage(room, user, messageId, body) {
  const message = await findInRoom(room._id, messageId);
  if (!sameId(message.author, user._id)) throw ApiError.forbidden('Solo puedes editar tus propios mensajes');

  message.body = body;
  message.editedAt = new Date();
  await message.save();
  await message.populate('author', USER_SUMMARY_FIELDS);

  const payload = serialize(message);
  emitToRoom(room._id, 'message:updated', payload);
  return payload;
}

export async function deleteMessage(room, user, membership, messageId) {
  const message = await findInRoom(room._id, messageId);
  if (!sameId(message.author, user._id) && membership.role !== 'admin') {
    throw ApiError.forbidden('Solo puedes eliminar tus mensajes');
  }

  await message.deleteOne();
  await Room.updateOne({ _id: room._id, 'stats.messages': { $gt: 0 } }, { $inc: { 'stats.messages': -1 } });
  emitToRoom(room._id, 'message:deleted', { _id: message._id, room: room._id });
}

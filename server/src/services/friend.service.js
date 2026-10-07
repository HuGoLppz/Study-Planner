import { USER_SUMMARY_FIELDS } from '../config/constants.js';
import { Friendship } from '../models/Friendship.js';
import { User } from '../models/User.js';
import { serializeUserSummary } from '../serializers/user.serializer.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';
import { notify, resolveActionable } from './notification.service.js';

const otherUser = (friendship, userId) => friendship.users.find((user) => !sameId(user._id ?? user, userId));

export async function listFriends(userId) {
  const friendships = await Friendship.find({ users: userId, status: 'accepted' }).populate(
    'users',
    `${USER_SUMMARY_FIELDS} studies course`,
  );

  return friendships
    .map((friendship) => {
      const friend = otherUser(friendship, userId);
      return {
        ...serializeUserSummary(friend),
        studies: friend.studies,
        course: friend.course,
        friendsSince: friendship.acceptedAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function countFriends(userId) {
  return Friendship.countDocuments({ users: userId, status: 'accepted' });
}

export async function listRequests(userId) {
  const [incoming, outgoing] = await Promise.all([
    Friendship.find({ recipient: userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('requester', `${USER_SUMMARY_FIELDS} studies course`),
    Friendship.find({ requester: userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('recipient', `${USER_SUMMARY_FIELDS} studies course`),
  ]);

  const shape = (friendship, user) => ({
    _id: friendship._id,
    createdAt: friendship.createdAt,
    user: { ...serializeUserSummary(user), studies: user.studies, course: user.course },
  });

  return {
    incoming: incoming.map((friendship) => shape(friendship, friendship.requester)),
    outgoing: outgoing.map((friendship) => shape(friendship, friendship.recipient)),
  };
}

export async function areFriends(a, b) {
  if (sameId(a, b)) return false;
  return Boolean(await Friendship.exists({ pairKey: Friendship.pairKeyFor(a, b), status: 'accepted' }));
}

// Estado de la relación del usuario con cada id: 'self' | 'friends' | 'request_sent' | 'request_received' | 'none'
export async function relationshipMap(viewerId, userIds) {
  const keys = userIds.filter((id) => !sameId(id, viewerId)).map((id) => Friendship.pairKeyFor(viewerId, id));
  const friendships = await Friendship.find({ pairKey: { $in: keys } });

  const map = new Map(userIds.map((id) => [String(id), { status: sameId(id, viewerId) ? 'self' : 'none' }]));
  for (const friendship of friendships) {
    const other = String(otherUser(friendship, viewerId));
    if (friendship.status === 'accepted') {
      map.set(other, { status: 'friends' });
    } else {
      const sent = sameId(friendship.requester, viewerId);
      map.set(other, { status: sent ? 'request_sent' : 'request_received', requestId: friendship._id });
    }
  }
  return map;
}

async function accept(friendship, accepter) {
  friendship.status = 'accepted';
  friendship.acceptedAt = new Date();
  await friendship.save();

  await Promise.all([
    resolveActionable({ recipient: accepter._id, type: 'friend_request', actor: friendship.requester }),
    notify({
      recipients: [friendship.requester],
      type: 'friend_accepted',
      actor: accepter._id,
      data: { actorName: accepter.name, actorHandle: accepter.handle },
    }),
  ]);
  return friendship;
}

export async function sendRequest(requester, targetId) {
  if (sameId(requester._id, targetId)) {
    throw ApiError.badRequest('No puedes enviarte una solicitud a ti mismo', 'SELF_REQUEST');
  }

  const target = await User.exists({ _id: targetId });
  if (!target) throw ApiError.notFound('Este estudiante no existe');

  const pairKey = Friendship.pairKeyFor(requester._id, targetId);
  const existing = await Friendship.findOne({ pairKey });

  if (existing?.status === 'accepted') throw ApiError.conflict('Ya sois amigos', 'ALREADY_FRIENDS');
  if (existing && sameId(existing.requester, requester._id)) {
    throw ApiError.conflict('Ya le has enviado una solicitud', 'REQUEST_ALREADY_SENT');
  }
  // Si la otra persona ya te había enviado una solicitud, enviarle otra equivale a aceptarla.
  if (existing) {
    await accept(existing, requester);
    return { status: 'friends' };
  }

  const friendship = await Friendship.create({
    pairKey,
    users: [requester._id, targetId],
    requester: requester._id,
    recipient: targetId,
  });

  await notify({
    recipients: [targetId],
    type: 'friend_request',
    actor: requester._id,
    data: { actorName: requester.name, actorHandle: requester.handle, requestId: friendship._id },
  });
  return { status: 'request_sent', requestId: friendship._id };
}

export async function acceptRequest(user, requestId) {
  const friendship = await Friendship.findOne({ _id: requestId, recipient: user._id, status: 'pending' });
  if (!friendship) throw ApiError.notFound('Esta solicitud ya no está disponible');
  await accept(friendship, user);
  return { status: 'friends' };
}

// Rechazar (destinatario) o cancelar (remitente) una solicitud pendiente.
export async function deleteRequest(user, requestId) {
  const friendship = await Friendship.findOneAndDelete({
    _id: requestId,
    status: 'pending',
    $or: [{ requester: user._id }, { recipient: user._id }],
  });
  if (!friendship) throw ApiError.notFound('Esta solicitud ya no está disponible');

  await resolveActionable({ type: 'friend_request', 'data.requestId': friendship._id });
}

export async function removeFriend(user, friendId) {
  const result = await Friendship.deleteOne({
    pairKey: Friendship.pairKeyFor(user._id, friendId),
    status: 'accepted',
  });
  if (result.deletedCount === 0) throw ApiError.notFound('No tienes a este estudiante entre tus amigos');
}

import { Room } from '../models/Room.js';
import { ApiError } from '../utils/ApiError.js';
import { isObjectId } from '../utils/ids.js';

const NOT_FOUND = 'Esta sala no existe o ya no formas parte de ella';

// Carga la sala de :roomId y comprueba que el usuario es participante (o administrador).
// Deja la sala en req.room y la participación en req.membership.
export const loadRoom = ({ role = 'member' } = {}) => async (req, _res, next) => {
  const { roomId } = req.params;
  if (!isObjectId(roomId)) throw ApiError.notFound(NOT_FOUND, 'ROOM_NOT_FOUND');

  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound(NOT_FOUND, 'ROOM_NOT_FOUND');

  const membership = room.membershipOf(req.user._id);
  if (!membership) {
    if (room.isInvited(req.user._id)) {
      throw ApiError.forbidden('Tienes una invitación pendiente para esta sala', 'ROOM_INVITATION_PENDING', {
        room: { _id: room._id, name: room.name },
      });
    }
    throw ApiError.notFound(NOT_FOUND, 'ROOM_NOT_FOUND');
  }

  if (role === 'admin' && membership.role !== 'admin') {
    throw ApiError.forbidden('Solo los administradores de la sala pueden hacer esto', 'ROOM_ADMIN_REQUIRED');
  }

  req.room = room;
  req.membership = membership;
  next();
};

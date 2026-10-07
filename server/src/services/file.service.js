import path from 'node:path';
import { LIMITS, USER_SUMMARY_FIELDS } from '../config/constants.js';
import { Room } from '../models/Room.js';
import { RoomFile } from '../models/RoomFile.js';
import { serializeUserSummary } from '../serializers/user.serializer.js';
import { emitToRoom } from '../sockets/emitter.js';
import { fileExists, paths, removeFile } from '../uploads/storage.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';

function serialize(file) {
  return {
    _id: file._id,
    room: file.room,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    uploadedBy: file.uploadedBy?.name ? serializeUserSummary(file.uploadedBy) : { _id: file.uploadedBy, name: null },
    createdAt: file.createdAt,
  };
}

export async function listFiles(roomId) {
  const files = await RoomFile.find({ room: roomId }).sort({ createdAt: -1 }).populate('uploadedBy', USER_SUMMARY_FIELDS);
  return files.map(serialize);
}

export async function assertFileQuota(room) {
  if (room.stats.files >= LIMITS.filesPerRoom) {
    throw ApiError.conflict(`La sala ha llegado al máximo de ${LIMITS.filesPerRoom} archivos`, 'FILE_LIMIT');
  }
}

export async function createFile(room, user, upload) {
  try {
    const file = await RoomFile.create({
      room: room._id,
      uploadedBy: user._id,
      originalName: upload.originalname,
      storedName: upload.filename,
      mimeType: upload.canonicalMime,
      size: upload.size,
    });
    await Room.updateOne({ _id: room._id }, { $inc: { 'stats.files': 1 }, $set: { lastActivityAt: new Date() } });
    await file.populate('uploadedBy', USER_SUMMARY_FIELDS);

    const payload = serialize(file);
    emitToRoom(room._id, 'room:files', { roomId: room._id });
    return payload;
  } catch (error) {
    await removeFile(upload.path);
    throw error;
  }
}

async function findFile(roomId, fileId) {
  const file = await RoomFile.findOne({ _id: fileId, room: roomId }).select('+storedName');
  if (!file) throw ApiError.notFound('Este archivo ya no existe');
  return file;
}

const diskPath = (roomId, storedName) => path.join(paths.room(roomId), path.basename(storedName));

export async function getDownload(roomId, fileId) {
  const file = await findFile(roomId, fileId);
  const filePath = diskPath(roomId, file.storedName);
  if (!(await fileExists(filePath))) throw ApiError.notFound('El archivo ya no está disponible en el servidor');
  return { filePath, file };
}

export async function deleteFile(room, user, membership, fileId) {
  const file = await findFile(room._id, fileId);
  if (!sameId(file.uploadedBy, user._id) && membership.role !== 'admin') {
    throw ApiError.forbidden('Solo quien subió el archivo o un administrador puede eliminarlo');
  }

  await file.deleteOne();
  await removeFile(diskPath(room._id, file.storedName));
  await Room.updateOne({ _id: room._id, 'stats.files': { $gt: 0 } }, { $inc: { 'stats.files': -1 } });
  emitToRoom(room._id, 'room:files', { roomId: room._id });
}

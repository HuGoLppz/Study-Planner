// Punto único para difundir eventos. Los servicios no conocen Socket.IO directamente.
let io = null;

export const channels = {
  user: (userId) => `user:${userId}`,
  room: (roomId) => `room:${roomId}`,
};

export function bindSocketServer(server) {
  io = server;
}

export function emitToUser(userId, event, payload) {
  io?.to(channels.user(String(userId))).emit(event, payload);
}

export function emitToRoom(roomId, event, payload) {
  io?.to(channels.room(String(roomId))).emit(event, payload);
}

// Saca de un canal de sala todas las conexiones de un usuario (expulsado o que sale).
export function detachUserFromRoom(userId, roomId) {
  io?.in(channels.user(String(userId))).socketsLeave(
    channels.room(String(roomId)),
  );
}

export function closeRoomChannel(roomId) {
  io?.in(channels.room(String(roomId))).socketsLeave(
    channels.room(String(roomId)),
  );
}

import { parse as parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { authenticateToken } from '../auth/session.js';
import { env } from '../config/env.js';
import { Room } from '../models/Room.js';
import { isObjectId } from '../utils/ids.js';
import { bindSocketServer, channels } from './emitter.js';

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    maxHttpBufferSize: 64 * 1024,
  });

  // Misma cookie de sesión que la API REST.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
      const user = await authenticateToken(cookies[env.cookieName]);
      socket.data.user = { _id: String(user._id), name: user.name };
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(channels.user(user._id));

    socket.on('room:join', async (roomId, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!isObjectId(roomId)) return reply({ ok: false });

      const isMember = await Room.exists({ _id: roomId, 'members.user': user._id });
      if (!isMember) return reply({ ok: false });

      socket.join(channels.room(roomId));
      return reply({ ok: true });
    });

    socket.on('room:leave', (roomId) => {
      if (isObjectId(roomId)) socket.leave(channels.room(roomId));
    });

    socket.on('room:typing', (roomId) => {
      const channel = channels.room(roomId);
      if (isObjectId(roomId) && socket.rooms.has(channel)) {
        socket.to(channel).emit('room:typing', { roomId, user });
      }
    });
  });

  bindSocketServer(io);
  return io;
}

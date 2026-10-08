import { createAdapter as createClusterAdapter } from "@socket.io/cluster-adapter";
import { createAdapter as createRedisAdapter } from "@socket.io/redis-adapter";
import { parse as parseCookie } from "cookie";
import { Server } from "socket.io";
import { authenticateToken } from "../auth/session.js";
import { clustered } from "../cluster/role.js";
import { env } from "../config/env.js";
import { createRedisConnection, redis } from "../infra/redis.js";
import { isMember } from "../services/room.service.js";
import { isPublicId } from "../utils/ids.js";
import { bindSocketServer, channels } from "./emitter.js";

export async function initSockets(httpServer) {
  // Solo WebSocket: cada conexión vive entera en un proceso, así que ni el cluster ni varias
  // máquinas necesitan sesiones "sticky" (con long-polling, cada petición podría caer en otro).
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    transports: ["websocket"],
  });
  // Los eventos de una sala llegan también a quien está conectado a otro proceso (cluster) o a
  // otra máquina (Redis).
  if (redis()) {
    io.adapter(
      createRedisAdapter(
        await createRedisConnection("socket.io pub"),
        await createRedisConnection("socket.io sub"),
      ),
    );
  } else if (clustered) {
    io.adapter(createClusterAdapter());
  }

  // Misma cookie de sesión que la API REST.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
      const user = await authenticateToken(cookies[env.cookieName]);
      socket.data.user = { _id: String(user._id), name: user.name };
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket.data;
    socket.join(channels.user(user._id));

    socket.on("room:join", async (roomId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (!isPublicId(roomId) || !(await isMember(roomId, user._id)))
          return reply({ ok: false });
        socket.join(channels.room(roomId));
        return reply({ ok: true });
      } catch {
        return reply({ ok: false });
      }
    });

    socket.on("room:leave", (roomId) => {
      if (isPublicId(roomId)) socket.leave(channels.room(roomId));
    });

    socket.on("room:typing", (roomId) => {
      const channel = channels.room(roomId);
      if (isPublicId(roomId) && socket.rooms.has(channel)) {
        socket.to(channel).emit("room:typing", { roomId, user });
      }
    });
  });

  bindSocketServer(io);
  return io;
}

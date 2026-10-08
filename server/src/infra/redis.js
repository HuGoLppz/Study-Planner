import { createClient } from "redis";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Redis (REDIS_URL, opcional) coordina varias máquinas: Socket.IO, límites de peticiones y avisos
// entre servidores (cluster/bus.js). Sin Redis, todo funciona en una sola máquina.

let client = null;
const extra = [];

function track(connection, name) {
  let lastError = 0;
  connection.on("error", (error) => {
    // node-redis reintenta solo; se registra como mucho una vez cada 10 s para no llenar el registro.
    if (Date.now() - lastError > 10_000)
      logger.error(`Redis (${name}): ${error.message}`);
    lastError = Date.now();
  });
  return connection;
}

export async function connectRedis() {
  if (!env.redisUrl || client) return client;
  client = track(createClient({ url: env.redisUrl }), "principal");
  await client.connect();
  logger.info("Redis conectado");
  return client;
}

export const redis = () => client;

// Conexión aparte (una suscripción ocupa la conexión entera: Socket.IO y el bus usan las suyas).
export async function createRedisConnection(name) {
  const connection = track(client.duplicate(), name);
  await connection.connect();
  extra.push(connection);
  return connection;
}

export async function disconnectRedis() {
  await Promise.allSettled(
    [client, ...extra].filter(Boolean).map((connection) => connection.quit()),
  );
  client = null;
  extra.length = 0;
}

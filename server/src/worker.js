import http from "node:http";
import { clustered, isLeader } from "./cluster/role.js";
import { useRedisBus } from "./cluster/bus.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/db.js";
import {
  connectRedis,
  createRedisConnection,
  disconnectRedis,
} from "./infra/redis.js";
import { startReminderJob } from "./jobs/reminders.js";
import { objectStore } from "./uploads/objectStore.js";
import { startEventLoopMonitor } from "./utils/eventLoop.js";
import { logger } from "./utils/logger.js";

// Un proceso de la API: Express + Socket.IO con su propio grupo de conexiones a PostgreSQL. Con
// WORKERS=1 es el único proceso; en cluster hay varios escuchando el mismo puerto (cluster/primary.js),
// y con Redis puede haber varias máquinas con la misma base de datos y el mismo almacenamiento.
export async function startWorker() {
  // Redis va primero: los limitadores de peticiones (al importar app.js) y Socket.IO lo usan.
  const redis = await connectRedis();
  if (redis) await useRedisBus(redis, await createRedisConnection("bus"));
  // En cluster, el proceso principal ya ha aplicado el esquema y preparado el almacenamiento.
  await connectDatabase({ applyMigrations: !clustered });
  if (!clustered) await objectStore.init();

  const { createApp } = await import("./app.js");
  const { initSockets } = await import("./sockets/index.js");
  const server = http.createServer(createApp());
  const io = await initSockets(server);
  // Los recordatorios corren en el proceso 0 de cada máquina; las tareas se reclaman con
  // FOR UPDATE SKIP LOCKED, así que varias máquinas a la vez no avisan dos veces.
  const stopReminders = isLeader ? startReminderJob() : () => {};
  const stopMonitor = startEventLoopMonitor();

  // backlog: conexiones pendientes de aceptar en un pico (por defecto 511).
  server.listen({ port: env.port, backlog: 2048 }, () => {
    if (!isLeader) return;
    const processes = clustered ? `${env.workers} procesos` : "1 proceso";
    const shared = [redis && "Redis", env.s3 && "S3"]
      .filter(Boolean)
      .join(" y ");
    logger.info(
      `API escuchando en http://localhost:${env.port}/api (${env.nodeEnv}, ${processes}${shared ? `, con ${shared}` : ""})`,
    );
  });

  let closing = false;
  const shutdown = (reason) => {
    if (closing) return;
    closing = true;
    if (!clustered) logger.info(`${reason} recibido, cerrando…`);
    stopReminders();
    stopMonitor();
    io.close();
    server.close(async () => {
      await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("message", (message) => {
    if (message?.type === "sp:shutdown") shutdown("Cierre ordenado");
  });
  // Si el proceso principal desaparece (fallo o reinicio de node --watch), este se cierra en vez de
  // quedarse huérfano con conexiones abiertas.
  if (clustered)
    process.on("disconnect", () => shutdown("Proceso principal cerrado"));
}

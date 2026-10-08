import cluster from "node:cluster";
import { ClusterMemoryStorePrimary } from "@express-rate-limit/cluster-memory-store";
import { setupPrimary as setupSocketPrimary } from "@socket.io/cluster-adapter";
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../database/db.js";
import { objectStore } from "../uploads/objectStore.js";
import { logger } from "../utils/logger.js";
import { relayBus } from "./bus.js";

const SHUTDOWN_TIMEOUT_MS = 12_000;

// Proceso principal del cluster: no atiende peticiones. Prepara la base de datos, arranca un proceso
// de la API por núcleo (WORKERS), les reparte las conexiones y, sin Redis, guarda los contadores de
// los límites de peticiones y reenvía los mensajes entre ellos. Si un proceso cae, lo vuelve a arrancar.
export async function startPrimary() {
  // El esquema se aplica aquí, una sola vez, antes de que arranque ningún proceso.
  await connectDatabase();
  await disconnectDatabase();
  await objectStore.init();

  // Reparto rotatorio: el principal acepta cada conexión y se la entrega al siguiente proceso, que
  // ya la lee y responde directamente. (En Windows, por defecto, reparte el sistema y lo hace mal.)
  cluster.schedulingPolicy = cluster.SCHED_RR;
  cluster.setupPrimary({ serialization: "advanced" });
  // Sin Redis, el principal coordina a los procesos de esta máquina; con Redis lo hace Redis.
  if (!env.redisUrl) {
    setupSocketPrimary(); // Socket.IO: los eventos llegan a las salas de todos los procesos
    new ClusterMemoryStorePrimary().init(); // límites de peticiones compartidos
    relayBus();
  }

  const indexOf = new Map(); // id del proceso → índice estable (0, 1, 2…)
  const crashes = [];
  let shuttingDown = false;

  const fork = (index) => {
    const worker = cluster.fork({ SP_WORKER_INDEX: String(index) });
    indexOf.set(worker.id, index);
  };

  cluster.on("exit", (worker, code, signal) => {
    const index = indexOf.get(worker.id);
    indexOf.delete(worker.id);
    if (shuttingDown) {
      if (Object.keys(cluster.workers).length === 0) process.exit(0);
      return;
    }
    // Si cae muchas veces seguidas, se espera cada vez más antes de reintentarlo (hasta 30 s).
    const now = Date.now();
    while (crashes.length && now - crashes[0] > 60_000) crashes.shift();
    crashes.push(now);
    const delay = Math.min(30_000, 500 * 2 ** (crashes.length - 1));
    logger.error(
      `El proceso ${index} se ha detenido (${signal ?? `código ${code}`}); se reinicia en ${delay} ms.`,
    );
    setTimeout(() => fork(index), delay);
  });

  for (let index = 0; index < env.workers; index += 1) fork(index);
  logger.info(
    `Proceso principal ${process.pid}: arrancando ${env.workers} procesos de la API en el puerto ${env.port}.`,
  );

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} recibido, cerrando los procesos…`);
    for (const worker of Object.values(cluster.workers))
      worker?.send({ type: "sp:shutdown" });
    if (Object.keys(cluster.workers).length === 0) process.exit(0);
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

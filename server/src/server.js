import "./config/threadpool.js";
import cluster from "node:cluster";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

// Con WORKERS > 1, este proceso es el principal del cluster y arranca los procesos de la API; si no,
// es la propia API. Cada módulo se importa solo en el proceso que lo usa.
async function start() {
  if (cluster.isPrimary && env.workers > 1) {
    const { startPrimary } = await import("./cluster/primary.js");
    await startPrimary();
  } else {
    const { startWorker } = await import("./worker.js");
    await startWorker();
  }
}

start().catch((error) => {
  logger.error("No se pudo arrancar el servidor:", error.message);
  process.exit(1);
});

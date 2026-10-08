import os from "node:os";

// WORKERS: cuántos procesos de la API arrancar. "auto" = uno por núcleo. Por defecto 1 (sin cluster).
// Sin dependencias: lo leen también config/threadpool.js y config/env.js antes que nada.
export function resolveWorkers(value = process.env.WORKERS) {
  if (!value) return 1;
  if (value === "auto") return os.availableParallelism();
  const workers = Number(value);
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error('WORKERS debe ser un número entero positivo o "auto".');
  }
  return Math.min(workers, 64);
}

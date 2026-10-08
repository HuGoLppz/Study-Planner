import os from "node:os";
import { resolveWorkers } from "./workers.js";

// Hilos de libuv: bcrypt (contraseñas), sharp (fotos) y el disco comparten este pool. Por defecto
// son 4; se reparten los núcleos entre los procesos de la API (entre 4 y 16 hilos por proceso).
// Debe fijarse antes del primer uso del pool, por eso este módulo es el primer import de server.js.
// UV_THREADPOOL_SIZE en el entorno tiene prioridad.
const perProcess = Math.ceil(os.availableParallelism() / resolveWorkers());
process.env.UV_THREADPOOL_SIZE ??= String(
  Math.min(16, Math.max(4, perProcess)),
);

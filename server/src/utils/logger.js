/* eslint-disable no-console */
import cluster from "node:cluster";

// En cluster, cada línea indica qué proceso la escribe.
const tag = cluster.isWorker
  ? ` [proceso ${process.env.SP_WORKER_INDEX ?? cluster.worker.id}]`
  : "";
const stamp = () => `[${new Date().toISOString()}]${tag}`;

export const logger = {
  info: (...args) => console.log(stamp(), ...args),
  warn: (...args) => console.warn(stamp(), ...args),
  error: (...args) => console.error(stamp(), ...args),
};

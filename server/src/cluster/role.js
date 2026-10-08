import cluster from "node:cluster";

// Papel de este proceso. Sin cluster (WORKERS=1) hay un único proceso que lo hace todo.
export const clustered = cluster.isWorker;

// Índice estable del proceso (0, 1, 2…): se conserva aunque el proceso se reinicie tras un fallo.
export const workerIndex = clustered
  ? Number(process.env.SP_WORKER_INDEX ?? 0)
  : 0;

// Lo que debe ocurrir en un solo proceso (recordatorios, limpieza de avisos) corre en el 0.
export const isLeader = workerIndex === 0;

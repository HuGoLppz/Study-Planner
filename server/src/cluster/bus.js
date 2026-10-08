import cluster from "node:cluster";
import crypto from "node:crypto";

// Mensajes entre los procesos de la API para que todos se enteren de algo que solo ha visto uno,
// por ejemplo, que hay que olvidar una caché. Según el despliegue:
//   * con Redis (varias máquinas): canal de publicación/suscripción de Redis;
//   * en cluster sin Redis (una máquina): IPC a través del proceso principal;
//   * con un solo proceso: no hace nada, el único proceso ya lo sabe.
const TYPE = "sp:bus";
const REDIS_CHANNEL = "study-planner:bus";
const instance = crypto.randomUUID(); // para no procesar los mensajes propios que devuelve Redis
const handlers = new Map();
let redisPublisher = null;

const deliver = (message) => handlers.get(message.channel)?.(message.payload);

export function publish(channel, payload) {
  if (redisPublisher) {
    redisPublisher
      .publish(
        REDIS_CHANNEL,
        JSON.stringify({ from: instance, channel, payload }),
      )
      .catch(() => {});
  } else if (cluster.isWorker && process.connected) {
    process.send({ type: TYPE, channel, payload });
  }
}

export function subscribe(channel, handler) {
  handlers.set(channel, handler);
}

if (cluster.isWorker) {
  process.on("message", (message) => {
    if (message?.type === TYPE && !redisPublisher) deliver(message);
  });
}

// Con Redis: publica con la conexión principal y escucha con una conexión propia.
export async function useRedisBus(publisher, subscriber) {
  redisPublisher = publisher;
  await subscriber.subscribe(REDIS_CHANNEL, (raw) => {
    const message = JSON.parse(raw);
    if (message.from !== instance) deliver(message);
  });
}

// Proceso principal del cluster sin Redis: reenvía cada mensaje al resto de procesos.
export function relayBus() {
  cluster.on("message", (sender, message) => {
    if (message?.type !== TYPE) return;
    for (const worker of Object.values(cluster.workers)) {
      if (worker && worker !== sender && worker.isConnected())
        worker.send(message);
    }
  });
}

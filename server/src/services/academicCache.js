// Caché en memoria de las estadísticas académicas de cada usuario (dashboard, notas y perfil).
// Solo dependen de sus propias tareas, notas y asignaturas, que únicamente cambia él, así que cada
// escritura suya la invalida (invalidateAcademic) y la caducidad cubre lo que cambia con el reloj
// (una tarea que pasa a estar atrasada).
//
// Cada proceso tiene su caché. En cluster, la invalidación se avisa a los demás por el bus del
// cluster (IPC, menos de un milisegundo), así que ningún proceso sirve estadísticas viejas tras una
// escritura atendida por otro.
import { publish, subscribe } from "../cluster/bus.js";

const TTL_MS = 30 * 1000;
const MAX_USERS = 5000;

const entries = new Map(); // usuario → { key, value, expires }

// Se guarda la promesa en cuanto empieza el cálculo: así dos peticiones simultáneas comparten una
// sola consulta, y una invalidación que llegue mientras tanto borra la entrada y ese resultado (que
// pudo leer datos de antes del cambio) ya no se vuelve a guardar.
export function cachedAcademic(userId, key, compute) {
  const id = String(userId);
  const entry = entries.get(id);
  if (entry && entry.key === key && entry.expires > Date.now())
    return entry.value;

  const value = Promise.resolve().then(compute);
  entries.delete(id); // al volver a insertar queda al final: se descartan antes los menos usados
  if (entries.size >= MAX_USERS) entries.delete(entries.keys().next().value);
  const stored = { key, value, expires: Date.now() + TTL_MS };
  entries.set(id, stored);
  value.catch(() => {
    if (entries.get(id) === stored) entries.delete(id); // un fallo no se queda en la caché
  });
  return value;
}

export function invalidateAcademic(userId) {
  entries.delete(String(userId));
  publish("academic:invalidate", String(userId));
}

subscribe("academic:invalidate", (userId) => entries.delete(userId));

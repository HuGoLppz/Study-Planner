import { nowIso, sql } from "../database/db.js";
import {
  notify,
  purgeOldNotifications,
} from "../services/notification.service.js";
import { logger } from "../utils/logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

// Avisa una vez de cada tarea pendiente que vence en las próximas 24 horas. Corre en el proceso 0
// de cada máquina (cluster/role.js); cada tarea se reclama con un único UPDATE … RETURNING y
// FOR UPDATE SKIP LOCKED, así que aunque varias máquinas lo ejecuten a la vez se reparten las tareas
// y ninguna se avisa dos veces.
export async function sendDueReminders(now = new Date()) {
  // Se marca antes de notificar: es preferible perder un aviso a duplicarlo.
  const tasks = await sql(
    `UPDATE Tareas SET recordatorio_enviado = @sentAt
      WHERE tarea_id IN (SELECT tarea_id FROM Tareas
                          WHERE recordatorio_enviado IS NULL AND estado <> 'completed'
                            AND fecha_entrega BETWEEN @from AND @to
                          LIMIT @batch
                          FOR UPDATE SKIP LOCKED)
      RETURNING tarea_id, usuario_id, titulo, fecha_entrega`,
  ).all({
    sentAt: nowIso(),
    from: now.toISOString(),
    to: new Date(now.getTime() + DAY_MS).toISOString(),
    batch: BATCH,
  });

  if (tasks.length === 0) return 0;

  for (const task of tasks) {
    await notify({
      recipients: [task.usuario_id],
      type: "task_due",
      task: task.tarea_id,
      data: { taskTitle: task.titulo, dueDate: task.fecha_entrega },
    });
  }
  return tasks.length;
}

export function startReminderJob({ intervalMs = 10 * 60 * 1000 } = {}) {
  const run = async () => {
    try {
      const sent = await sendDueReminders();
      if (sent > 0) logger.info(`Recordatorios enviados: ${sent}`);
      await purgeOldNotifications();
    } catch (error) {
      logger.error("Fallo en el job de recordatorios", error);
    }
  };

  const first = setTimeout(run, 5000);
  const timer = setInterval(run, intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

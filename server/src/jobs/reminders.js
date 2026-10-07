import { Task } from '../models/Task.js';
import { notify } from '../services/notification.service.js';
import { logger } from '../utils/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

// Avisa una vez de cada tarea pendiente que vence en las próximas 24 horas.
export async function sendDueReminders(now = new Date()) {
  const tasks = await Task.find({
    reminderSentAt: null,
    status: { $ne: 'completed' },
    dueDate: { $gte: now, $lte: new Date(now.getTime() + DAY_MS) },
  })
    .select('owner title dueDate')
    .limit(BATCH);

  if (tasks.length === 0) return 0;

  // Se marca antes de notificar: es preferible perder un aviso a duplicarlo.
  await Task.updateMany({ _id: { $in: tasks.map((task) => task._id) } }, { $set: { reminderSentAt: now } });

  for (const task of tasks) {
    await notify({
      recipients: [task.owner],
      type: 'task_due',
      task: task._id,
      data: { taskTitle: task.title, dueDate: task.dueDate },
    });
  }
  return tasks.length;
}

export function startReminderJob({ intervalMs = 10 * 60 * 1000 } = {}) {
  const run = async () => {
    try {
      const sent = await sendDueReminders();
      if (sent > 0) logger.info(`Recordatorios enviados: ${sent}`);
    } catch (error) {
      logger.error('Fallo en el job de recordatorios', error);
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

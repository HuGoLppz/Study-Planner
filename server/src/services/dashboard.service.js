import { Task } from '../models/Task.js';
import { listFriends } from './friend.service.js';
import { computeAcademicStats } from './grade.service.js';
import { countUnread, listNotifications } from './notification.service.js';
import { getDay } from './pomodoro.service.js';
import { getAgenda, listInvitations, listRooms } from './room.service.js';
import { overdueFilter, summarizeTasks } from './task.service.js';

// Todo lo que necesita la pantalla "Hoy" en una sola respuesta. `from`/`to` y `day` los
// calcula el cliente con su zona horaria (inicio de hoy, +14 días, fecha local).
export async function getDashboard(user, { from, to, day, timeZone }, now = new Date()) {
  const [summary, horizon, overdue, stats, notifications, unread, rooms, invitations, friends, pomodoro, events] =
    await Promise.all([
      summarizeTasks(user._id, now),
      Task.find({ owner: user._id, status: { $ne: 'completed' }, dueDate: { $gte: from, $lte: to } })
        .sort({ dueDate: 1 })
        .limit(150),
      Task.find({ owner: user._id, ...overdueFilter(now) }).sort({ dueDate: 1 }).limit(5),
      computeAcademicStats(user, { now, timeZone }),
      listNotifications(user._id, { limit: 5 }),
      countUnread(user._id),
      listRooms(user._id),
      listInvitations(user._id),
      listFriends(user._id),
      getDay(user._id, day),
      getAgenda(user._id, { from: now, to }),
    ]);

  return {
    generatedAt: now,
    summary,
    horizon,
    overdue,
    grades: {
      average: stats.average,
      graded: stats.totals.graded,
      ungraded: stats.totals.ungraded,
      bySubject: stats.bySubject
        .filter((row) => row.graded > 0)
        .map(({ subject, average, graded }) => ({ subject, average, graded })),
    },
    progress: stats.totals,
    notifications: { items: notifications.items, unread },
    rooms: { items: rooms.slice(0, 4), total: rooms.length, invitations: invitations.length },
    friends: { items: friends.slice(0, 8), total: friends.length },
    pomodoro: { day: pomodoro.day, totals: pomodoro.totals },
    events: events.slice(0, 6),
  };
}

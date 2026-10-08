import { countFriends, listFriends } from "./friend.service.js";
import { computeAcademicStats } from "./grade.service.js";
import { countUnread, listNotifications } from "./notification.service.js";
import { getDay } from "./pomodoro.service.js";
import {
  countUserInvitations,
  countUserRooms,
  getAgenda,
  listRooms,
} from "./room.service.js";
import { listOverdue, listUpcoming, summarizeTasks } from "./task.service.js";

// Todo lo que necesita la pantalla "Hoy" en una sola respuesta. `from`/`to` y `day` los
// calcula el cliente con su zona horaria (inicio de hoy, +14 días, fecha local).
// Las consultas son independientes y van en paralelo.
export async function getDashboard(
  user,
  { from, to, day, timeZone },
  now = new Date(),
) {
  const [
    stats,
    notifications,
    unread,
    pomodoro,
    summary,
    horizon,
    overdue,
    rooms,
    roomCount,
    invitations,
    friends,
    friendCount,
    events,
  ] = await Promise.all([
    computeAcademicStats(user, { now, timeZone }),
    listNotifications(user._id, { limit: 5 }),
    countUnread(user._id),
    getDay(user._id, day),
    summarizeTasks(user._id, now),
    listUpcoming(user._id, { from, to, limit: 150 }),
    listOverdue(user._id, { now, limit: 5 }),
    // Solo lo que se pinta: cuatro salas, ocho amigos y los totales.
    listRooms(user._id, { limit: 4 }),
    countUserRooms(user._id),
    countUserInvitations(user._id),
    listFriends(user._id, { limit: 8 }),
    countFriends(user._id),
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
    rooms: { items: rooms, total: roomCount, invitations },
    friends: { items: friends, total: friendCount },
    pomodoro: { day: pomodoro.day, totals: pomodoro.totals },
    events: events.slice(0, 6),
  };
}

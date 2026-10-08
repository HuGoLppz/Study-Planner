// Aplica un `room:patch` del servidor (solo lo que ha cambiado) sobre la sala que hay en caché.
export function applyRoomPatch(
  room,
  {
    info,
    members,
    invitations,
    tasks,
    task,
    deletedTaskId,
    stats,
    lastActivityAt,
  },
) {
  const next = {
    ...room,
    ...info,
    lastActivityAt: lastActivityAt ?? room.lastActivityAt,
    stats: stats ?? room.stats,
  };
  if (members) next.members = members;
  if (invitations) next.invitations = invitations;
  if (tasks) next.tasks = tasks;
  if (task) {
    next.tasks = next.tasks.some((item) => item._id === task._id)
      ? next.tasks.map((item) => (item._id === task._id ? task : item))
      : [...next.tasks, task];
  }
  if (deletedTaskId)
    next.tasks = next.tasks.filter((item) => item._id !== deletedTaskId);
  return next;
}

import { formatDueShort } from './dates.js';

const quote = (text) => `«${text}»`;

// Texto y destino de cada tipo de aviso. Los datos vienen de la instantánea guardada en el servidor.
export function describeNotification(notification) {
  const { type, data = {}, room, task } = notification;
  const actor = notification.actor?.name ?? data.actorName ?? 'Alguien';

  switch (type) {
    case 'friend_request':
      return { text: `${actor} te ha enviado una solicitud de amistad`, href: '/amigos?tab=solicitudes' };
    case 'friend_accepted':
      return { text: `${actor} ha aceptado tu solicitud de amistad`, href: data.actorHandle ? `/u/${data.actorHandle}` : '/amigos' };
    case 'room_invitation':
      return { text: `${actor} te ha invitado a la sala ${data.roomName}`, href: '/salas' };
    case 'room_member_joined':
      return { text: `${actor} se ha unido a ${data.roomName}`, href: room ? `/salas/${room}` : '/salas' };
    case 'room_role_changed':
      return { text: `${actor} te ha dado permisos de administración en ${data.roomName}`, href: room ? `/salas/${room}` : '/salas' };
    case 'room_task_assigned':
      return { text: `${actor} te ha asignado ${quote(data.taskTitle)} en ${data.roomName}`, href: room ? `/salas/${room}?panel=tareas` : '/salas' };
    case 'task_due':
      return { text: `${quote(data.taskTitle)} vence ${formatDueShort(data.dueDate).toLowerCase()}`, taskId: task };
    default:
      return { text: 'Tienes un aviso nuevo', href: null };
  }
}

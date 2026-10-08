import {
  CalendarDots,
  ChatsCircle,
  Crown,
  ListChecks,
  Trash,
  UserCheck,
  UserPlus,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
} from "../../hooks/useFriends.js";
import {
  useDeleteNotification,
  useSetNotificationRead,
} from "../../hooks/useNotifications.js";
import {
  useAcceptRoomInvitation,
  useDeclineRoomInvitation,
} from "../../hooks/useRooms.js";
import { useUiStore } from "../../store/uiStore.js";
import { formatAgo } from "../../utils/dates.js";
import { describeNotification } from "../../utils/notifications.js";
import { Avatar } from "../ui/Avatar.jsx";
import { Button, IconButton } from "../ui/Button.jsx";

const ICONS = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  room_invitation: ChatsCircle,
  room_member_joined: ChatsCircle,
  room_role_changed: Crown,
  room_task_assigned: ListChecks,
  task_due: CalendarDots,
};

// Solicitudes e invitaciones se resuelven desde el propio aviso.
function InlineActions({ notification }) {
  const acceptFriend = useAcceptFriendRequest();
  const declineFriend = useDeclineFriendRequest();
  const acceptRoom = useAcceptRoomInvitation();
  const declineRoom = useDeclineRoomInvitation();
  const navigate = useNavigate();

  if (notification.read) return null;

  if (notification.type === "friend_request" && notification.data?.requestId) {
    const requestId = notification.data.requestId;
    return (
      <div className="notifications-inline-actions">
        <Button
          size="sm"
          onClick={() => acceptFriend.mutate(requestId)}
          loading={acceptFriend.isPending}
        >
          Aceptar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => declineFriend.mutate(requestId)}
          loading={declineFriend.isPending}
        >
          Rechazar
        </Button>
      </div>
    );
  }
  if (notification.type === "room_invitation" && notification.room) {
    return (
      <div className="notifications-inline-actions">
        <Button
          size="sm"
          loading={acceptRoom.isPending}
          onClick={() =>
            acceptRoom.mutate(notification.room, {
              onSuccess: () => navigate(`/salas/${notification.room}`),
            })
          }
        >
          Unirme
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => declineRoom.mutate(notification.room)}
          loading={declineRoom.isPending}
        >
          Rechazar
        </Button>
      </div>
    );
  }
  return null;
}

export function NotificationItem({ notification, onNavigate }) {
  const navigate = useNavigate();
  const openTask = useUiStore((state) => state.openTask);
  const setRead = useSetNotificationRead();
  const remove = useDeleteNotification();
  const { text, href, taskId } = describeNotification(notification);
  const Icon = ICONS[notification.type] ?? CalendarDots;

  const open = () => {
    if (!notification.read)
      setRead.mutate({ id: notification._id, read: true });
    if (taskId) openTask(taskId);
    else if (href) navigate(href);
    onNavigate?.();
  };

  return (
    <li
      className={clsx(
        "notifications-item",
        !notification.read && "notifications-unread",
      )}
    >
      <span className="notifications-visual">
        {notification.actor ? (
          <Avatar user={notification.actor} size="md" />
        ) : (
          <span className="notifications-icon-circle">
            <Icon size={20} aria-hidden />
          </span>
        )}
        {notification.actor ? (
          <span className="notifications-type-icon">
            <Icon size={12} weight="bold" aria-hidden />
          </span>
        ) : null}
      </span>
      <div className="notifications-content">
        <button type="button" className="notifications-text" onClick={open}>
          {!notification.read ? (
            <span className="visually-hidden">Sin leer: </span>
          ) : null}
          {text}
        </button>
        <span className="notifications-time">
          {formatAgo(notification.createdAt)}
        </span>
        <InlineActions notification={notification} />
      </div>
      <div className="notifications-item-actions">
        <button
          type="button"
          className="notifications-read-toggle"
          onClick={() =>
            setRead.mutate({ id: notification._id, read: !notification.read })
          }
          aria-label={
            notification.read ? "Marcar como no leído" : "Marcar como leído"
          }
          title={
            notification.read ? "Marcar como no leído" : "Marcar como leído"
          }
        >
          <span className="notifications-dot" />
        </button>
        <IconButton
          icon={Trash}
          label="Eliminar aviso"
          size="sm"
          onClick={() => remove.mutate(notification._id)}
        />
      </div>
    </li>
  );
}

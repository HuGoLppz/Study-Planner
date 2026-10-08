import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { notificationsApi } from "../services/api.js";
import { connectSocket } from "../services/socket.js";
import { getErrorMessage } from "../utils/errors.js";
import { describeNotification } from "../utils/notifications.js";
import { qk } from "./queryKeys.js";

export function useNotificationList({ unread = false, limit = 20 } = {}) {
  return useInfiniteQuery({
    queryKey: [...qk.notifications.list(unread), limit],
    queryFn: ({ pageParam }) =>
      notificationsApi.list({ unread, before: pageParam, limit }),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useUnreadCount() {
  // Los avisos nuevos llegan por el socket; el sondeo solo cubre una conexión caída.
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 15 * 60 * 1000,
  });
}

function useNotificationMutation(mutationFn, success) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (success) toast.success(success);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export const useSetNotificationRead = () =>
  useNotificationMutation(({ id, read }) => notificationsApi.setRead(id, read));
export const useReadAllNotifications = () =>
  useNotificationMutation(notificationsApi.readAll, "Todo marcado como leído");
export const useDeleteNotification = () =>
  useNotificationMutation(notificationsApi.remove, "Aviso eliminado");

// Escucha global: avisos nuevos, expulsiones de salas. Se monta una vez en el layout privado.
export function useRealtimeNotifications(enabled) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = connectSocket();

    const onNotification = (notification) => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (notification.type.startsWith("friend_"))
        queryClient.invalidateQueries({ queryKey: qk.friends.all });
      if (notification.type.startsWith("room_"))
        queryClient.invalidateQueries({ queryKey: qk.rooms.all });

      const { text, href } = describeNotification(notification);
      toast(
        text,
        href
          ? { action: { label: "Ver", onClick: () => navigate(href) } }
          : undefined,
      );
    };

    const onRemoved = ({ roomId, roomName }) => {
      queryClient.removeQueries({ queryKey: qk.rooms.detail(roomId) });
      queryClient.invalidateQueries({ queryKey: qk.rooms.all });
      toast(`Ya no formas parte de ${roomName}`);
      if (window.location.pathname === `/salas/${roomId}`)
        navigate("/salas", { replace: true });
    };

    socket.on("notification:new", onNotification);
    socket.on("room:removed", onRemoved);
    return () => {
      socket.off("notification:new", onNotification);
      socket.off("room:removed", onRemoved);
    };
  }, [enabled, queryClient, navigate]);
}

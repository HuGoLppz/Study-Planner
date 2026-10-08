import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { roomsApi } from "../services/api.js";
import { getErrorMessage } from "../utils/errors.js";
import { qk } from "./queryKeys.js";

export function useRooms() {
  return useQuery({ queryKey: qk.rooms.list, queryFn: roomsApi.list });
}

export function useRoomInvitations() {
  return useQuery({
    queryKey: qk.rooms.invitations,
    queryFn: roomsApi.invitations,
  });
}

export function useRoom(roomId) {
  return useQuery({
    queryKey: qk.rooms.detail(roomId),
    queryFn: () => roomsApi.get(roomId),
    enabled: Boolean(roomId),
    retry: false,
  });
}

export function useRoomAgenda(from, to) {
  return useQuery({
    queryKey: qk.rooms.agenda(from.toISOString(), to.toISOString()),
    queryFn: () => roomsApi.agenda(from.toISOString(), to.toISOString()),
    placeholderData: keepPreviousData,
  });
}

// Mutaciones que devuelven la sala completa: se escribe en caché y se refrescan listados.
function useRoomMutation(
  mutationFn,
  success,
  { onDone, silentFields = false } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (room, variables) => {
      if (room?._id) queryClient.setQueryData(qk.rooms.detail(room._id), room);
      queryClient.invalidateQueries({ queryKey: qk.rooms.list });
      queryClient.invalidateQueries({ queryKey: qk.rooms.invitations });
      queryClient.invalidateQueries({ queryKey: ["rooms", "agenda"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (success)
        toast.success(
          typeof success === "function" ? success(room, variables) : success,
        );
      onDone?.(room, variables);
    },
    onError: (error) => {
      if (!(silentFields && error.fields)) toast.error(getErrorMessage(error));
    },
  });
}

export const useCreateRoom = () =>
  useRoomMutation(roomsApi.create, "Sala creada", { silentFields: true });
export const useUpdateRoom = () =>
  useRoomMutation(
    ({ id, data }) => roomsApi.update(id, data),
    "Sala actualizada",
    { silentFields: true },
  );
export const useInviteToRoom = () =>
  useRoomMutation(
    ({ id, userIds }) => roomsApi.invite(id, userIds),
    (_room, { userIds }) =>
      userIds.length === 1
        ? "Invitación enviada"
        : `${userIds.length} invitaciones enviadas`,
  );
export const useAcceptRoomInvitation = () =>
  useRoomMutation(roomsApi.acceptInvitation, "Te has unido a la sala");
export const useCancelRoomInvitation = () =>
  useRoomMutation(
    ({ id, userId }) => roomsApi.cancelInvitation(id, userId),
    "Invitación retirada",
  );
export const useSetMemberRole = () =>
  useRoomMutation(
    ({ id, userId, role }) => roomsApi.setMemberRole(id, userId, role),
    (_room, { role }) =>
      role === "admin"
        ? "Permisos de administración concedidos"
        : "Permisos de administración retirados",
  );
export const useRemoveMember = () =>
  useRoomMutation(
    ({ id, userId }) => roomsApi.removeMember(id, userId),
    "Participante eliminado de la sala",
  );
export const useCreateRoomTask = () =>
  useRoomMutation(
    ({ id, data }) => roomsApi.createTask(id, data),
    "Tarea añadida a la sala",
    { silentFields: true },
  );
export const useUpdateRoomTask = () =>
  useRoomMutation(
    ({ id, taskId, data }) => roomsApi.updateTask(id, taskId, data),
    null,
    { silentFields: true },
  );
export const useDeleteRoomTask = () =>
  useRoomMutation(
    ({ id, taskId }) => roomsApi.removeTask(id, taskId),
    "Tarea eliminada",
  );

export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }) => roomsApi.removeMember(id, userId),
    onSuccess: (_room, { id }) => {
      queryClient.removeQueries({ queryKey: qk.rooms.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.rooms.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Has salido de la sala");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeclineRoomInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.declineInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rooms.invitations });
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Invitación rechazada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.remove,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: qk.rooms.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.rooms.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Sala eliminada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { friendsApi, usersApi } from "../services/api.js";
import { getErrorMessage } from "../utils/errors.js";
import { qk } from "./queryKeys.js";

export function useFriends() {
  return useQuery({ queryKey: qk.friends.list, queryFn: friendsApi.list });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: qk.friends.requests,
    queryFn: friendsApi.requests,
  });
}

export function useUserSearch(q) {
  const term = q.trim();
  return useQuery({
    queryKey: qk.friends.search(term),
    queryFn: () => usersApi.search(term),
    enabled: term.replace(/^@/, "").length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useProfile(handle) {
  return useQuery({
    queryKey: qk.profile(handle),
    queryFn: () => usersApi.profile(handle),
    enabled: Boolean(handle),
    retry: false,
  });
}

function useFriendMutation(mutationFn, success) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: qk.friends.all });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      const message = typeof success === "function" ? success(result) : success;
      if (message) toast.success(message);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export const useSendFriendRequest = () =>
  useFriendMutation(friendsApi.sendRequest, (relationship) =>
    relationship?.status === "friends"
      ? "Ahora sois amigos"
      : "Solicitud enviada",
  );
export const useAcceptFriendRequest = () =>
  useFriendMutation(friendsApi.acceptRequest, "Solicitud aceptada");
export const useDeclineFriendRequest = () =>
  useFriendMutation(friendsApi.deleteRequest, "Solicitud retirada");
export const useRemoveFriend = () =>
  useFriendMutation(friendsApi.remove, "Amistad eliminada");

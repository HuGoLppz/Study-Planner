import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "../services/api.js";
import { getErrorMessage } from "../utils/errors.js";
import { qk } from "./queryKeys.js";

// Proveedores activados en el servidor (los botones solo salen si hay alguno). No cambian en una sesión.
export function useOAuthProviders() {
  return useQuery({
    queryKey: qk.oauth.providers,
    queryFn: authApi.oauthProviders,
    staleTime: Infinity,
    retry: false,
  });
}

export function useOAuthLinks(enabled = true) {
  return useQuery({
    queryKey: qk.oauth.links,
    queryFn: authApi.oauthLinks,
    enabled,
  });
}

export function useLinkAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, credential }) =>
      authApi.oauthLink(provider, credential),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.oauth.links });
      toast.success("Cuenta vinculada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useUnlinkAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.oauthUnlink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.oauth.links });
      toast.success("Cuenta desvinculada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

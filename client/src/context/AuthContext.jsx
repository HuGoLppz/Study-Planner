import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { qk } from "../hooks/queryKeys.js";
import { authApi } from "../services/api.js";
import { onUnauthorized } from "../services/http.js";
import { disconnectSocket } from "../services/socket.js";
import { usePomodoroStore } from "../store/pomodoroStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const {
    data: user,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.me,
    queryFn: authApi.me,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const setUser = useCallback(
    (next) => queryClient.setQueryData(qk.me, next),
    [queryClient],
  );

  const endSession = useCallback(() => {
    disconnectSocket();
    usePomodoroStore.getState().clear();
    queryClient.clear();
    queryClient.setQueryData(qk.me, null);
  }, [queryClient]);

  // Cualquier 401 de la API significa que la sesión ha caducado o se ha revocado.
  useEffect(() => {
    onUnauthorized(() => {
      if (queryClient.getQueryData(qk.me)) endSession();
    });
    return () => onUnauthorized(null);
  }, [endSession, queryClient]);

  const value = useMemo(
    () => ({
      user: user ?? null,
      status: isPending ? "loading" : user ? "authenticated" : "anonymous",
      isError,
      retry: refetch,
      setUser,
      login: async (credentials) => setUser(await authApi.login(credentials)),
      register: async (data) => setUser(await authApi.register(data)),
      loginWithProvider: async (provider, credential) =>
        setUser(await authApi.oauthLogin(provider, credential)),
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          endSession();
        }
      },
    }),
    [user, isPending, isError, refetch, setUser, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}

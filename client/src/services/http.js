import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "/api";

export const http = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 20000,
});

// Error normalizado para toda la app: { status, message, code, fields }
export class ApiError extends Error {
  constructor({ status, message, code, fields, details }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields ?? null;
    this.details = details ?? null;
  }
}

let unauthorizedHandler = null;

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

const SESSION_PROBES = [
  "/auth/me",
  "/auth/login",
  "/auth/register",
  "/auth/password",
];

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const status = error.response?.status ?? 0;
    const payload = error.response?.data?.error;
    const apiError = new ApiError({
      status,
      code: payload?.code ?? (status === 0 ? "NETWORK_ERROR" : "ERROR"),
      message:
        payload?.message ??
        (status === 0
          ? "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo."
          : "Algo ha fallado. Inténtalo de nuevo."),
      fields: payload?.fields,
      details: payload,
    });

    const url = error.config?.url ?? "";
    if (
      status === 401 &&
      !SESSION_PROBES.some((probe) => url.startsWith(probe))
    ) {
      unauthorizedHandler?.(apiError);
    }
    return Promise.reject(apiError);
  },
);

// Atajo: devuelve directamente el cuerpo de la respuesta.
export const request = {
  get: (url, config) => http.get(url, config).then((response) => response.data),
  post: (url, body, config) =>
    http.post(url, body, config).then((response) => response.data),
  put: (url, body, config) =>
    http.put(url, body, config).then((response) => response.data),
  patch: (url, body, config) =>
    http.patch(url, body, config).then((response) => response.data),
  delete: (url, config) =>
    http.delete(url, config).then((response) => response.data),
};

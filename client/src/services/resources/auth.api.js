import { request } from "../http.js";

export async function me() {
  try {
    const { user } = await request.get("/auth/me");
    return user;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export const login = (credentials) =>
  request.post("/auth/login", credentials).then((data) => data.user);
export const register = (data) =>
  request.post("/auth/register", data).then((body) => body.user);
export const logout = () => request.post("/auth/logout");
export const changePassword = (data) => request.patch("/auth/password", data);

// Inicio de sesión con Google o Apple: el servidor verifica el id_token que dan ellos.
export const oauthProviders = () =>
  request.get("/auth/oauth/providers").then((data) => data.providers);
export const oauthLogin = (provider, credential) =>
  request
    .post(`/auth/oauth/${provider}`, { credential })
    .then((data) => data.user);
export const oauthLinks = () =>
  request.get("/auth/oauth/links").then((data) => data.links);
export const oauthLink = (provider, credential) =>
  request
    .post(`/auth/oauth/${provider}/link`, { credential })
    .then((data) => data.link);
export const oauthUnlink = (provider) =>
  request.delete(`/auth/oauth/${provider}`);

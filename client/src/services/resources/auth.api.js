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

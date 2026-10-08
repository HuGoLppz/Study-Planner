import { http, request } from "../http.js";

export const search = (q) =>
  request.get("/users/search", { params: { q } }).then((data) => data.items);
export const profile = (handle) =>
  request
    .get(`/users/handle/${encodeURIComponent(handle)}`)
    .then((data) => data.profile);
export const updateMe = (data) =>
  request.patch("/users/me", data).then((body) => body.user);
export const updatePrivacy = (data) =>
  request.patch("/users/me/privacy", data).then((body) => body.user);
export const updatePreferences = (data) =>
  request.patch("/users/me/preferences", data).then((body) => body.user);
export const removeAvatar = () =>
  request.delete("/users/me/avatar").then((body) => body.user);

export function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  return http
    .put("/users/me/avatar", form)
    .then((response) => response.data.user);
}

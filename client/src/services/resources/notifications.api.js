import { request } from "../http.js";

export const list = ({ unread, before, limit = 20 } = {}) =>
  request.get("/notifications", {
    params: {
      limit,
      ...(unread ? { unread: "true" } : {}),
      ...(before ? { before } : {}),
    },
  });
export const unreadCount = () =>
  request.get("/notifications/unread-count").then((data) => data.count);
export const setRead = (id, read) =>
  request
    .patch(`/notifications/${id}`, { read })
    .then((data) => data.notification);
export const readAll = () => request.post("/notifications/read-all");
export const remove = (id) => request.delete(`/notifications/${id}`);

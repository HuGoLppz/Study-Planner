import { request } from "../http.js";

export const list = (params = {}) =>
  request.get("/grades", { params }).then((data) => data.items);
export const stats = (tz) =>
  request.get("/grades/stats", { params: { tz } }).then((data) => data.stats);
export const set = (taskId, score) =>
  request.put(`/grades/${taskId}`, { score }).then((body) => body.task);
export const remove = (taskId) =>
  request.delete(`/grades/${taskId}`).then((body) => body.task);

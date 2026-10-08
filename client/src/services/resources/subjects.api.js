import { request } from "../http.js";

export const create = (data) =>
  request.post("/subjects", data).then((body) => body.subject);
export const update = (id, data) =>
  request.patch(`/subjects/${id}`, data).then((body) => body.subject);
export const remove = (id) => request.delete(`/subjects/${id}`);

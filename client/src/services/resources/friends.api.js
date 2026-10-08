import { request } from "../http.js";

export const list = () => request.get("/friends").then((data) => data.items);
export const requests = () => request.get("/friends/requests");
export const sendRequest = (userId) =>
  request
    .post("/friends/requests", { userId })
    .then((body) => body.relationship);
export const acceptRequest = (requestId) =>
  request
    .post(`/friends/requests/${requestId}/accept`)
    .then((body) => body.relationship);
export const deleteRequest = (requestId) =>
  request.delete(`/friends/requests/${requestId}`);
export const remove = (userId) => request.delete(`/friends/${userId}`);

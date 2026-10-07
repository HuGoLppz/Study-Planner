import { request } from '../http.js';

export const list = (roomId, before) =>
  request.get(`/rooms/${roomId}/messages`, { params: before ? { before } : {} });
export const send = (roomId, body) => request.post(`/rooms/${roomId}/messages`, { body }).then((data) => data.message);
export const update = (roomId, messageId, body) =>
  request.patch(`/rooms/${roomId}/messages/${messageId}`, { body }).then((data) => data.message);
export const remove = (roomId, messageId) => request.delete(`/rooms/${roomId}/messages/${messageId}`);

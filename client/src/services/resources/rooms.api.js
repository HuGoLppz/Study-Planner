import { request } from '../http.js';

const room = (body) => body.room;

export const list = () => request.get('/rooms').then((data) => data.items);
export const invitations = () => request.get('/rooms/invitations').then((data) => data.items);
export const agenda = (from, to) => request.get('/rooms/agenda', { params: { from, to } }).then((data) => data.items);
export const get = (id) => request.get(`/rooms/${id}`).then(room);
export const create = (data) => request.post('/rooms', data).then(room);
export const update = (id, data) => request.patch(`/rooms/${id}`, data).then(room);
export const remove = (id) => request.delete(`/rooms/${id}`);

export const invite = (id, userIds) => request.post(`/rooms/${id}/invitations`, { userIds }).then(room);
export const acceptInvitation = (id) => request.post(`/rooms/${id}/invitations/accept`).then(room);
export const declineInvitation = (id) => request.post(`/rooms/${id}/invitations/decline`);
export const cancelInvitation = (id, userId) => request.delete(`/rooms/${id}/invitations/${userId}`).then(room);

export const setMemberRole = (id, userId, role) => request.patch(`/rooms/${id}/members/${userId}`, { role }).then(room);
export const removeMember = (id, userId) => request.delete(`/rooms/${id}/members/${userId}`).then(room);

export const createTask = (id, data) => request.post(`/rooms/${id}/tasks`, data).then(room);
export const updateTask = (id, taskId, data) => request.patch(`/rooms/${id}/tasks/${taskId}`, data).then(room);
export const removeTask = (id, taskId) => request.delete(`/rooms/${id}/tasks/${taskId}`).then(room);

import { request } from '../http.js';

// Quita filtros vacíos para que la URL y la caché sean estables.
const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null));

export const list = (params) => request.get('/tasks', { params: clean(params) });
export const summary = () => request.get('/tasks/summary').then((data) => data.summary);
export const get = (id) => request.get(`/tasks/${id}`).then((data) => data.task);
export const create = (data) => request.post('/tasks', data).then((body) => body.task);
export const update = (id, data) => request.patch(`/tasks/${id}`, data).then((body) => body.task);
export const remove = (id) => request.delete(`/tasks/${id}`);
export const complete = (id, score) =>
  request.post(`/tasks/${id}/complete`, score == null ? {} : { score }).then((body) => body.task);
export const reopen = (id) => request.post(`/tasks/${id}/reopen`).then((body) => body.task);

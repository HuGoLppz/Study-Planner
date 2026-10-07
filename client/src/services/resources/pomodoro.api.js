import { request } from '../http.js';

export const settings = () => request.get('/pomodoro/settings').then((data) => data.settings);
export const updateSettings = (data) => request.put('/pomodoro/settings', data).then((body) => body.settings);
export const logSession = (session) => request.post('/pomodoro/sessions', session).then((body) => body.day);
export const day = (dayKey) => request.get('/pomodoro/today', { params: { day: dayKey } }).then((data) => data.day);
export const history = (from, to) => request.get('/pomodoro/history', { params: { from, to } }).then((data) => data.items);

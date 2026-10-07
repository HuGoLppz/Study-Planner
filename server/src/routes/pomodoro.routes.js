import { Router } from 'express';
import * as pomodoro from '../controllers/pomodoro.controller.js';
import { validate } from '../middleware/validate.js';
import { historySchema, logSessionSchema, pomodoroSettingsSchema, todaySchema } from '../validators/pomodoro.schemas.js';

export const pomodoroRouter = Router();

pomodoroRouter.get('/settings', pomodoro.getSettings);
pomodoroRouter.put('/settings', validate(pomodoroSettingsSchema), pomodoro.updateSettings);
pomodoroRouter.post('/sessions', validate(logSessionSchema), pomodoro.logSession);
pomodoroRouter.get('/today', validate(todaySchema), pomodoro.today);
pomodoroRouter.get('/history', validate(historySchema), pomodoro.history);

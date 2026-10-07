import { POMODORO_PHASES } from '../config/constants.js';
import { date, dayKey, objectId, request, z } from './common.js';

export const pomodoroSettingsSchema = request({
  body: z.object({
    focusMinutes: z.coerce.number().int().min(1).max(120),
    breakMinutes: z.coerce.number().int().min(1).max(60),
    longBreakMinutes: z.coerce.number().int().min(1).max(90),
    cyclesBeforeLongBreak: z.coerce.number().int().min(1).max(12),
  }),
});

export const logSessionSchema = request({
  body: z
    .object({
      day: dayKey,
      phase: z.enum(POMODORO_PHASES),
      plannedSeconds: z.coerce.number().int().min(1).max(4 * 60 * 60),
      actualSeconds: z.coerce.number().int().min(0).max(4 * 60 * 60),
      completed: z.boolean(),
      startedAt: date,
      endedAt: date,
      subjectId: objectId.nullable().default(null),
    })
    .refine((value) => value.endedAt >= value.startedAt, {
      message: 'La sesión no puede terminar antes de empezar',
      path: ['endedAt'],
    }),
});

export const todaySchema = request({ query: z.object({ day: dayKey }) });

export const historySchema = request({ query: z.object({ from: dayKey, to: dayKey }) });

export const dashboardSchema = request({
  query: z.object({ from: date, to: date, day: dayKey, tz: z.string().max(64).default('UTC') }),
});

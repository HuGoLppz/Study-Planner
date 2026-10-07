import { LIMITS } from '../config/constants.js';
import { PomodoroDay } from '../models/PomodoroDay.js';
import { ApiError } from '../utils/ApiError.js';
import { assertOwnSubject } from './task.service.js';

const emptyDay = (day) => ({ day, sessions: [], totals: { focusSeconds: 0, breakSeconds: 0, completedFocus: 0 } });

export function getSettings(user) {
  return user.preferences.pomodoro;
}

export async function updateSettings(user, settings) {
  user.preferences.pomodoro = settings;
  await user.save();
  return user.preferences.pomodoro;
}

// Añade la sesión al documento del día (patrón bucket) con un único upsert atómico.
export async function logSession(user, { day, subjectId, ...session }) {
  assertOwnSubject(user, subjectId);

  const isFocus = session.phase === 'focus';
  const increments = isFocus
    ? { 'totals.focusSeconds': session.actualSeconds, 'totals.completedFocus': session.completed ? 1 : 0 }
    : { 'totals.breakSeconds': session.actualSeconds };

  try {
    const bucket = await PomodoroDay.findOneAndUpdate(
      { user: user._id, day, [`sessions.${LIMITS.sessionsPerDay - 1}`]: { $exists: false } },
      { $push: { sessions: { ...session, subject: subjectId } }, $inc: increments },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return bucket;
  } catch (error) {
    // El documento del día existe pero está lleno: el upsert choca con el índice único.
    if (error?.code === 11000) {
      throw ApiError.conflict('Has llegado al máximo de sesiones registradas hoy', 'POMODORO_DAY_FULL');
    }
    throw error;
  }
}

export async function getDay(userId, day) {
  const bucket = await PomodoroDay.findOne({ user: userId, day });
  return bucket ?? emptyDay(day);
}

export async function getHistory(userId, { from, to }) {
  const buckets = await PomodoroDay.find({ user: userId, day: { $gte: from, $lte: to } })
    .select('day totals')
    .sort({ day: 1 });
  return buckets.map((bucket) => ({ day: bucket.day, ...bucket.totals.toObject() }));
}

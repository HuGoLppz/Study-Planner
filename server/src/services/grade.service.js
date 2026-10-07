import { Task } from '../models/Task.js';
import { ApiError } from '../utils/ApiError.js';
import { round } from '../utils/text.js';
import { getTask } from './task.service.js';

const WEEKS_OF_HISTORY = 12;
const isGraded = { 'grade.score': { $exists: true } };

const countIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const isCompleted = { $eq: ['$status', 'completed'] };
const isOverdue = (now) => ({ $and: [{ $ne: ['$status', 'completed'] }, { $lt: ['$dueDate', now] }] });

function subjectLookup(user) {
  const map = new Map(user.subjects.map((subject) => [String(subject._id), subject]));
  return (id) => {
    const subject = id ? map.get(String(id)) : null;
    return subject ? { _id: subject._id, name: subject.name, color: subject.color } : null;
  };
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Todas las estadísticas académicas en una sola agregación sobre `tasks`.
export async function computeAcademicStats(user, { now = new Date(), timeZone = 'UTC' } = {}) {
  const since = new Date(now.getTime() - WEEKS_OF_HISTORY * 7 * 24 * 60 * 60 * 1000);
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';

  const [result] = await Task.aggregate([
    { $match: { owner: user._id } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: countIf(isCompleted),
              overdue: countIf(isOverdue(now)),
              graded: countIf({ $ne: [{ $type: '$grade.score' }, 'missing'] }),
            },
          },
        ],
        overall: [
          { $match: isGraded },
          {
            $group: {
              _id: null,
              average: { $avg: '$grade.score' },
              best: { $max: '$grade.score' },
              lowest: { $min: '$grade.score' },
            },
          },
        ],
        bySubject: [
          {
            $group: {
              _id: '$subject',
              total: { $sum: 1 },
              completed: countIf(isCompleted),
              overdue: countIf(isOverdue(now)),
              graded: countIf({ $ne: [{ $type: '$grade.score' }, 'missing'] }),
              average: { $avg: '$grade.score' },
            },
          },
        ],
        evolution: [
          { $match: isGraded },
          { $sort: { dueDate: 1, _id: 1 } },
          {
            $setWindowFields: {
              sortBy: { dueDate: 1 },
              output: {
                runningAverage: { $avg: '$grade.score', window: { documents: ['unbounded', 'current'] } },
              },
            },
          },
          { $project: { title: 1, subject: 1, type: 1, dueDate: 1, score: '$grade.score', runningAverage: 1 } },
        ],
        weekly: [
          { $match: { status: 'completed', completedAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateTrunc: { date: '$completedAt', unit: 'week', startOfWeek: 'monday', timezone: tz } },
              completed: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const subjectOf = subjectLookup(user);
  const totals = result.totals[0] ?? { total: 0, completed: 0, overdue: 0, graded: 0 };
  const overall = result.overall[0];

  const bySubject = result.bySubject
    .map((row) => ({
      subject: subjectOf(row._id),
      total: row.total,
      completed: row.completed,
      pending: row.total - row.completed,
      overdue: row.overdue,
      graded: row.graded,
      average: round(row.average),
      progress: row.total ? round(row.completed / row.total, 4) : 0,
    }))
    // Las tareas de asignaturas borradas cuentan como "sin asignatura".
    .reduce((rows, row) => {
      const key = row.subject ? String(row.subject._id) : 'none';
      const existing = rows.find((item) => (item.subject ? String(item.subject._id) : 'none') === key);
      if (!existing) return [...rows, row];
      const gradedTotal = existing.graded + row.graded;
      existing.average = gradedTotal
        ? round(((existing.average ?? 0) * existing.graded + (row.average ?? 0) * row.graded) / gradedTotal)
        : null;
      for (const field of ['total', 'completed', 'pending', 'overdue', 'graded']) existing[field] += row[field];
      existing.progress = existing.total ? round(existing.completed / existing.total, 4) : 0;
      return rows;
    }, [])
    .sort((a, b) => {
      if (!a.subject) return 1;
      if (!b.subject) return -1;
      return a.subject.name.localeCompare(b.subject.name, 'es');
    });

  return {
    totals: {
      total: totals.total,
      completed: totals.completed,
      pending: totals.total - totals.completed,
      overdue: totals.overdue,
      graded: totals.graded,
      ungraded: totals.completed - totals.graded,
      progress: totals.total ? round(totals.completed / totals.total, 4) : 0,
    },
    average: overall ? round(overall.average) : null,
    best: overall?.best ?? null,
    lowest: overall?.lowest ?? null,
    bySubject,
    evolution: result.evolution.map((point) => ({
      taskId: point._id,
      title: point.title,
      type: point.type,
      subject: subjectOf(point.subject),
      date: point.dueDate,
      score: point.score,
      runningAverage: round(point.runningAverage),
    })),
    weekly: result.weekly.map((week) => ({ weekStart: week._id, completed: week.completed })),
  };
}

export function listGradedTasks(userId, { subject } = {}) {
  return Task.find({ owner: userId, ...isGraded, ...(subject ? { subject } : {}) }).sort({ dueDate: -1 });
}

export async function setGrade(userId, taskId, score) {
  const task = await getTask(userId, taskId);
  if (task.status !== 'completed') {
    throw ApiError.conflict('Marca la tarea como completada antes de ponerle nota', 'TASK_NOT_COMPLETED');
  }
  task.grade = { score, gradedAt: new Date() };
  return task.save();
}

export async function removeGrade(userId, taskId) {
  const task = await getTask(userId, taskId);
  task.grade = undefined;
  return task.save();
}

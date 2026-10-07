import { Task } from '../models/Task.js';
import { ApiError } from '../utils/ApiError.js';
import { toObjectId } from '../utils/ids.js';
import { escapeRegex } from '../utils/text.js';

const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

const SORTS = {
  due: { dueDate: 1, _id: 1 },
  '-due': { dueDate: -1, _id: -1 },
  created: { createdAt: 1 },
  '-created': { createdAt: -1 },
  completed: { completedAt: -1, dueDate: -1 },
};

export const overdueFilter = (now = new Date()) => ({ status: { $ne: 'completed' }, dueDate: { $lt: now } });

// Una asignatura solo puede usarse si pertenece al propietario de la tarea.
export function assertOwnSubject(user, subjectId) {
  if (subjectId && !user.subjects.id(subjectId)) {
    throw ApiError.unprocessable('La asignatura no existe', { subjectId: 'Elige una de tus asignaturas' });
  }
}

function buildFilter(userId, query, now) {
  const filter = { owner: userId };

  if (query.status === 'pending') filter.status = { $ne: 'completed' };
  if (query.status === 'completed') filter.status = 'completed';
  if (query.status === 'overdue') Object.assign(filter, overdueFilter(now));

  // Los ids se convierten aquí porque aggregate() no aplica el casting de Mongoose.
  if (query.subject === 'none') filter.subject = null;
  else if (query.subject) filter.subject = toObjectId(query.subject);
  if (query.type) filter.type = query.type;
  if (query.priority) filter.priority = query.priority;

  if (query.from || query.to) {
    filter.dueDate = { ...(filter.dueDate ?? {}) };
    if (query.from) filter.dueDate.$gte = query.from;
    if (query.to) filter.dueDate.$lte = query.to;
  }

  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  return filter;
}

export async function listTasks(user, query, now = new Date()) {
  const filter = buildFilter(user._id, query, now);
  const skip = (query.page - 1) * query.limit;

  let items;
  if (query.sort === 'priority') {
    // La urgencia es un enum: se ordena por su peso con una agregación.
    items = await Task.aggregate([
      { $match: filter },
      { $addFields: { priorityWeight: { $switch: {
        branches: Object.entries(PRIORITY_WEIGHT).map(([value, weight]) => ({ case: { $eq: ['$priority', value] }, then: weight })),
        default: 3,
      } } } },
      { $sort: { priorityWeight: 1, dueDate: 1 } },
      { $skip: skip },
      { $limit: query.limit },
      { $project: { priorityWeight: 0, reminderSentAt: 0, __v: 0 } },
    ]);
  } else {
    items = await Task.find(filter).sort(SORTS[query.sort]).skip(skip).limit(query.limit);
  }

  const total = await Task.countDocuments(filter);
  return { items, total, page: query.page, hasMore: skip + items.length < total };
}

export async function summarizeTasks(userId, now = new Date()) {
  const [summary] = await Task.aggregate([
    { $match: { owner: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        overdue: {
          $sum: { $cond: [{ $and: [{ $ne: ['$status', 'completed'] }, { $lt: ['$dueDate', now] }] }, 1, 0] },
        },
      },
    },
  ]);

  const base = summary ?? { total: 0, completed: 0, inProgress: 0, overdue: 0 };
  return {
    total: base.total,
    completed: base.completed,
    inProgress: base.inProgress,
    overdue: base.overdue,
    pending: base.total - base.completed,
  };
}

export async function getTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId, owner: userId });
  if (!task) throw ApiError.notFound('Esta tarea no existe o se ha eliminado', 'TASK_NOT_FOUND');
  return task;
}

function applyStatus(task, status, now = new Date()) {
  if (status === task.status) return;
  task.status = status;
  if (status === 'completed') {
    task.completedAt = now;
  } else {
    task.completedAt = null;
    task.grade = undefined;
  }
}

export async function createTask(user, data) {
  assertOwnSubject(user, data.subjectId);
  const { subjectId, status, ...rest } = data;

  const task = new Task({ ...rest, owner: user._id, subject: subjectId });
  applyStatus(task, status);
  return task.save();
}

export async function updateTask(user, taskId, data) {
  const task = await getTask(user._id, taskId);
  const { subjectId, status, dueDate, ...rest } = data;

  if (subjectId !== undefined) {
    assertOwnSubject(user, subjectId);
    task.subject = subjectId;
  }
  if (dueDate && dueDate.getTime() !== task.dueDate.getTime()) {
    task.dueDate = dueDate;
    task.reminderSentAt = null;
  }
  if (status) applyStatus(task, status);
  task.set(rest);

  return task.save();
}

export async function completeTask(user, taskId, { score } = {}) {
  const task = await getTask(user._id, taskId);
  const now = new Date();

  applyStatus(task, 'completed', now);
  if (score !== undefined && score !== null) task.grade = { score, gradedAt: now };
  return task.save();
}

export async function reopenTask(user, taskId) {
  const task = await getTask(user._id, taskId);
  applyStatus(task, 'pending');
  return task.save();
}

export async function deleteTask(userId, taskId) {
  const result = await Task.deleteOne({ _id: taskId, owner: userId });
  if (result.deletedCount === 0) throw ApiError.notFound('Esta tarea no existe o se ha eliminado', 'TASK_NOT_FOUND');
}

// Al borrar una asignatura, sus tareas se quedan sin asignatura en lugar de desaparecer.
export function detachSubject(userId, subjectId) {
  return Task.updateMany({ owner: userId, subject: subjectId }, { $set: { subject: null } });
}

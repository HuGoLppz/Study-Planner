import mongoose from 'mongoose';
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../config/constants.js';

const { Schema, model } = mongoose;

// La calificación es 1:1 con la tarea y no existe sin ella: va embebida.
const gradeSchema = new Schema(
  {
    score: { type: Number, required: true, min: 0, max: 10 },
    gradedAt: { type: Date, required: true },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    // _id de una asignatura embebida en users.subjects del propietario
    subject: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, enum: TASK_TYPES, default: 'assignment' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    status: { type: String, enum: TASK_STATUSES, default: 'pending' },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    grade: { type: gradeSchema, default: undefined },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ owner: 1, dueDate: 1 });
taskSchema.index({ owner: 1, status: 1, dueDate: 1 });
taskSchema.index(
  { owner: 1, 'grade.gradedAt': -1 },
  { partialFilterExpression: { 'grade.score': { $exists: true } } },
);
taskSchema.index({ reminderSentAt: 1, dueDate: 1 });

taskSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.reminderSentAt;
    return ret;
  },
});

export const Task = model('Task', taskSchema);

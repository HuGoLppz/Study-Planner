import mongoose from 'mongoose';
import { POMODORO_PHASES } from '../config/constants.js';

const { Schema, model } = mongoose;

const sessionSchema = new Schema(
  {
    phase: { type: String, enum: POMODORO_PHASES, required: true },
    plannedSeconds: { type: Number, required: true, min: 1 },
    actualSeconds: { type: Number, required: true, min: 0 },
    completed: { type: Boolean, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    subject: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

// Patrón bucket: un documento por usuario y día con todas sus sesiones y totales.
const pomodoroDaySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    sessions: { type: [sessionSchema], default: [] },
    totals: {
      focusSeconds: { type: Number, default: 0 },
      breakSeconds: { type: Number, default: 0 },
      completedFocus: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

pomodoroDaySchema.index({ user: 1, day: 1 }, { unique: true });

export const PomodoroDay = model('PomodoroDay', pomodoroDaySchema);

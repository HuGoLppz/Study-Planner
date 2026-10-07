import mongoose from 'mongoose';
import { LIMITS, PROFILE_VISIBILITY, SUBJECT_COLORS, THEMES } from '../config/constants.js';
import { tokenize } from '../utils/text.js';

const { Schema, model } = mongoose;

// Asignaturas embebidas: acotadas, privadas del usuario y necesarias en casi todas las vistas.
const subjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    color: { type: String, enum: SUBJECT_COLORS, required: true },
  },
  { timestamps: true },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0, select: false },
    handle: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9._]{3,30}$/,
    },
    searchTokens: { type: [String], default: [], select: false },
    studies: { type: String, trim: true, maxlength: 120, default: '' },
    course: { type: String, trim: true, maxlength: 40, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    avatar: {
      type: new Schema(
        {
          fileName: { type: String, required: true },
          mimeType: { type: String, required: true },
          updatedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    privacy: {
      profileVisibility: { type: String, enum: PROFILE_VISIBILITY, default: 'friends' },
      searchable: { type: Boolean, default: true },
      showGrades: { type: Boolean, default: false },
    },
    preferences: {
      theme: { type: String, enum: THEMES, default: 'system' },
      pomodoro: {
        focusMinutes: { type: Number, min: 1, max: 120, default: 25 },
        breakMinutes: { type: Number, min: 1, max: 60, default: 5 },
        longBreakMinutes: { type: Number, min: 1, max: 90, default: 15 },
        cyclesBeforeLongBreak: { type: Number, min: 1, max: 12, default: 4 },
      },
    },
    subjects: {
      type: [subjectSchema],
      default: [],
      validate: {
        validator: (subjects) => subjects.length <= LIMITS.subjectsPerUser,
        message: `No puedes tener más de ${LIMITS.subjectsPerUser} asignaturas`,
      },
    },
  },
  { timestamps: true },
);

userSchema.index({ searchTokens: 1 });

userSchema.pre('save', function updateSearchTokens() {
  if (this.isModified('name') || this.isNew) {
    this.searchTokens = tokenize(this.name);
  }
});

export const User = model('User', userSchema);

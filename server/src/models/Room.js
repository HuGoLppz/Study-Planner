import mongoose from 'mongoose';
import { LIMITS, ROOM_ROLES, SUBJECT_COLORS, TASK_STATUSES } from '../config/constants.js';

const { Schema, model } = mongoose;

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROOM_ROLES, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const invitationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Tareas colaborativas embebidas: solo existen dentro de su sala y están acotadas.
const roomTaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    dueDate: { type: Date, default: null },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: TASK_STATUSES, default: 'pending' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const roomSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    scheduledAt: { type: Date, default: null },
    // Instantánea: las asignaturas son privadas de cada usuario.
    subject: {
      type: new Schema(
        {
          name: { type: String, required: true, trim: true, maxlength: 60 },
          color: { type: String, enum: SUBJECT_COLORS, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: {
      type: [memberSchema],
      validate: {
        validator: (members) => members.length > 0 && members.length <= LIMITS.membersPerRoom,
        message: `Una sala admite entre 1 y ${LIMITS.membersPerRoom} participantes`,
      },
    },
    invitations: { type: [invitationSchema], default: [] },
    tasks: {
      type: [roomTaskSchema],
      default: [],
      validate: {
        validator: (tasks) => tasks.length <= LIMITS.tasksPerRoom,
        message: `Una sala admite como máximo ${LIMITS.tasksPerRoom} tareas`,
      },
    },
    stats: {
      messages: { type: Number, default: 0, min: 0 },
      files: { type: Number, default: 0, min: 0 },
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

roomSchema.index({ 'members.user': 1, lastActivityAt: -1 });
roomSchema.index({ 'invitations.user': 1 });
roomSchema.index({ 'tasks.assignee': 1, 'tasks.dueDate': 1 });
roomSchema.index({ scheduledAt: 1 });

roomSchema.methods.membershipOf = function membershipOf(userId) {
  return this.members.find((member) => String(member.user?._id ?? member.user) === String(userId)) ?? null;
};

roomSchema.methods.isInvited = function isInvited(userId) {
  return this.invitations.some((invitation) => String(invitation.user?._id ?? invitation.user) === String(userId));
};

roomSchema.methods.adminCount = function adminCount() {
  return this.members.filter((member) => member.role === 'admin').length;
};

export const Room = model('Room', roomSchema);

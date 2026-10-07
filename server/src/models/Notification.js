import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../config/constants.js';

const { Schema, model } = mongoose;

const RETENTION_SECONDS = 60 * 60 * 24 * 180;

// "data" es una instantánea del momento en que ocurrió el hecho: permite pintar la
// notificación sin joins aunque el nombre de la sala o de la tarea cambie después.
const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    room: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    task: { type: Schema.Types.ObjectId, default: null },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipient: 1, _id: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ room: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const Notification = model('Notification', notificationSchema);

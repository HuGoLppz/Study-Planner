import mongoose from 'mongoose';
import { LIMITS } from '../config/constants.js';

const { Schema, model } = mongoose;

const messageSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: LIMITS.messageLength },
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Paginación por cursor sobre _id (creciente en el tiempo).
messageSchema.index({ room: 1, _id: -1 });

export const Message = model('Message', messageSchema);

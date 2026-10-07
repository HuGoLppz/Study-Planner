import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Solo metadatos: el binario vive en disco (uploads/rooms/<roomId>/<storedName>).
const roomFileSchema = new Schema(
  {
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    storedName: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

roomFileSchema.index({ room: 1, createdAt: -1 });

export const RoomFile = model('RoomFile', roomFileSchema);

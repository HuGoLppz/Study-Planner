import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Una arista por pareja de usuarios. Cada transición (solicitar, aceptar, eliminar) es una
// escritura atómica sobre un único documento.
const friendshipSchema = new Schema(
  {
    pairKey: { type: String, required: true, unique: true },
    users: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      validate: { validator: (users) => users.length === 2, message: 'Una amistad une a dos usuarios' },
    },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

friendshipSchema.index({ users: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });

friendshipSchema.statics.pairKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

export const Friendship = model('Friendship', friendshipSchema);

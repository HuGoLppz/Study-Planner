import mongoose from 'mongoose';

export const isObjectId = (value) => mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(String(value));

export const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

export const sameId = (a, b) => a != null && b != null && String(a) === String(b);

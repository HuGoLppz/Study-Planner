import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);
mongoose.set('toJSON', { versionKey: false });
mongoose.set('toObject', { versionKey: false });

export async function connectDatabase() {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB desconectado'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconectado'));

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  logger.info(`MongoDB conectado (${mongoose.connection.name})`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa server/.env (puedes partir de .env.example).`);
  }
  return value;
}

function fromServerRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(serverRoot, value);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
}

const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error('COOKIE_SAMESITE debe ser lax, strict o none.');
}

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  sessionDays: Number(process.env.SESSION_DAYS ?? 7),
  cookieName: process.env.COOKIE_NAME ?? 'sp_session',
  cookieSameSite: sameSite,
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction,
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: fromServerRoot(process.env.UPLOAD_DIR ?? 'uploads'),
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024,
  // Límite de la foto que se sube; la que se guarda pesa unos pocos KB tras optimizarla.
  maxAvatarSizeBytes: Number(process.env.MAX_AVATAR_SIZE_MB ?? 8) * 1024 * 1024,
  serveClient: process.env.SERVE_CLIENT === 'true',
  clientDist: fromServerRoot(process.env.CLIENT_DIST ?? '../client/dist'),
});

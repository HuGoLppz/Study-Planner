import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const limitHandler = (message) => (_req, _res, next) => next(new ApiError(429, message, 'RATE_LIMITED'));

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('Demasiadas peticiones. Espera unos minutos.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler('Demasiados intentos. Espera unos minutos antes de volver a probar.'),
});

// Defensa CSRF adicional a SameSite: las peticiones que modifican datos deben venir de un
// origen permitido o del propio servidor.
export function verifyOrigin(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  const selfOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin === selfOrigin || env.clientOrigins.includes(origin)) return next();

  return next(ApiError.forbidden('Origen no permitido', 'ORIGIN_REJECTED'));
}

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const ISSUER = 'study-planner';

export function signSessionToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0 }, env.jwtSecret, {
    expiresIn: `${env.sessionDays}d`,
    issuer: ISSUER,
  });
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: ISSUER });
  } catch {
    throw ApiError.unauthorized('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'SESSION_EXPIRED');
  }
}

import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifySessionToken } from './tokens.js';

// Resuelve el usuario de un token de sesión. Lo usan el middleware HTTP y el socket.
export async function authenticateToken(token) {
  if (!token) throw ApiError.unauthorized();

  const payload = verifySessionToken(token);
  const user = await User.findById(payload.sub).select('+tokenVersion');

  if (!user || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Tu sesión ya no es válida. Vuelve a iniciar sesión.', 'SESSION_REVOKED');
  }
  return user;
}

import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const ISSUER = "study-planner";
const ALGORITHM = "HS256";

// La clave se prepara una vez: si se pasa el secreto como texto, jsonwebtoken la reconstruye en
// cada petición (un 3 % de la CPU de la API en la prueba de carga).
const KEY = crypto.createSecretKey(Buffer.from(env.jwtSecret, "utf8"));

export function signSessionToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion ?? 0 }, KEY, {
    algorithm: ALGORITHM,
    expiresIn: `${env.sessionDays}d`,
    issuer: ISSUER,
  });
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, KEY, { algorithms: [ALGORITHM], issuer: ISSUER });
  } catch {
    throw ApiError.unauthorized(
      "Tu sesión ha caducado. Vuelve a iniciar sesión.",
      "SESSION_EXPIRED",
    );
  }
}

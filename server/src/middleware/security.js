import { ClusterMemoryStoreWorker } from "@express-rate-limit/cluster-memory-store";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { clustered } from "../cluster/role.js";
import { env } from "../config/env.js";
import { redis } from "../infra/redis.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WINDOW_MS = 15 * 60 * 1000;

const limitHandler = (message) => (_req, _res, next) =>
  next(new ApiError(429, message, "RATE_LIMITED"));

// Dónde se cuentan las peticiones: en Redis con varias máquinas, en el proceso principal en
// cluster y en memoria con un solo proceso. Así el límite es el mismo atienda quien atienda la
// petición. Cada limitador necesita su prefijo. (Este módulo se importa después de conectar Redis.)
function storeFor(prefix) {
  const client = redis();
  if (client)
    return new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
      prefix: `study-planner:limite:${prefix}:`,
    });
  if (clustered) return new ClusterMemoryStoreWorker({ prefix });
  return undefined;
}

const limiter = (prefix, options) =>
  rateLimit({
    windowMs: WINDOW_MS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: storeFor(prefix),
    ...options,
  });

// Los límites se cuentan por persona, no por IP: en el wifi de una universidad cientos de
// estudiantes comparten la misma IP pública y se bloquearían entre ellos.

// Red de seguridad por IP solo para peticiones sin sesión (las que llevan sesión se limitan por
// usuario en userLimiter; una cookie falsa no pasa de requireAuth, que es barato).
export const anonymousLimiter = limiter("anonymous", {
  limit: env.rateLimitAnonymous,
  skip: (req) => Boolean(req.cookies?.[env.cookieName]),
  handler: limitHandler("Demasiadas peticiones. Espera unos minutos."),
});

// Peticiones de cada usuario con sesión. Va después de requireAuth.
export const userLimiter = limiter("user", {
  limit: env.rateLimitApi,
  keyGenerator: (req) => `user:${req.user._id}`,
  handler: limitHandler("Demasiadas peticiones. Espera unos minutos."),
});

// Intentos fallidos de inicio de sesión por cuenta (correo) desde una IP: frena a quien prueba
// contraseñas sin bloquear a los compañeros de red.
export const loginLimiter = limiter("login", {
  limit: env.rateLimitAuth,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `login:${req.ip}:${String(req.body?.email ?? "")
      .trim()
      .toLowerCase()}`,
  handler: limitHandler(
    "Demasiados intentos. Espera unos minutos antes de volver a probar.",
  ),
});

// Fallos de autenticación desde una misma IP sumando todas las cuentas (contra ataques que
// prueban muchos correos). Es alto para no afectar a una red compartida.
export const authIpLimiter = limiter("auth-ip", {
  limit: env.rateLimitAuthIp,
  skipSuccessfulRequests: true,
  handler: limitHandler(
    "Demasiados intentos desde tu red. Espera unos minutos antes de volver a probar.",
  ),
});

// Cambio de contraseña: por usuario.
export const passwordLimiter = limiter("password", {
  limit: env.rateLimitAuth,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `password:${req.user._id}`,
  handler: limitHandler(
    "Demasiados intentos. Espera unos minutos antes de volver a probar.",
  ),
});

// Detrás de un proxy, sin TRUST_PROXY todas las peticiones parecen venir de la IP del proxy y los
// límites por IP se comparten entre todos los usuarios. Se avisa una vez en el registro.
let proxyWarned = false;
export function warnUntrustedProxy(req, _res, next) {
  if (!proxyWarned && !env.trustProxy && req.get("x-forwarded-for")) {
    proxyWarned = true;
    logger.warn(
      "Llegan peticiones con X-Forwarded-For pero TRUST_PROXY=0: configura TRUST_PROXY con los saltos de proxy.",
    );
  }
  next();
}

// Defensa CSRF adicional a SameSite: las peticiones que modifican datos deben venir de un
// origen permitido o del propio servidor.
export function verifyOrigin(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  const selfOrigin = `${req.protocol}://${req.get("host")}`;
  if (origin === selfOrigin || env.clientOrigins.includes(origin))
    return next();

  return next(ApiError.forbidden("Origen no permitido", "ORIGIN_REJECTED"));
}

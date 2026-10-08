import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkers } from "./workers.js";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Revisa server/.env (puedes partir de .env.example).`,
    );
  }
  return value;
}

function fromServerRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(serverRoot, value);
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres.");
}

const sameSite = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(sameSite)) {
  throw new Error("COOKIE_SAMESITE debe ser lax, strict o none.");
}

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  // Procesos de la API (cluster). 1 = sin cluster; "auto" = uno por núcleo.
  workers: resolveWorkers(),
  // PostgreSQL: postgres://usuario:contraseña@servidor:5432/base. El esquema se crea solo al arrancar.
  databaseUrl: required("DATABASE_URL"),
  // Conexiones abiertas por cada proceso de la API (con WORKERS=8 y 10, hasta 80 en total).
  databasePoolSize: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  // Redis (opcional): imprescindible con varias máquinas. Coordina Socket.IO, los límites de
  // peticiones y los avisos entre servidores. Sin él, solo un servidor (con uno o varios procesos).
  redisUrl: process.env.REDIS_URL || null,
  // Almacenamiento de archivos compatible con S3 (opcional): imprescindible con varias máquinas.
  // Sin S3_BUCKET, los archivos se guardan en UPLOAD_DIR, en el disco de este servidor.
  s3: process.env.S3_BUCKET
    ? Object.freeze({
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined, // vacío = AWS; si no, R2, SeaweedFS, MinIO…
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        accessKeyId: required("S3_ACCESS_KEY_ID"),
        secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
        createBucket: process.env.S3_CREATE_BUCKET === "true",
      })
    : null,
  jwtSecret,
  sessionDays: Number(process.env.SESSION_DAYS ?? 7),
  cookieName: process.env.COOKIE_NAME ?? "sp_session",
  cookieSameSite: sameSite,
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : isProduction,
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: fromServerRoot(process.env.UPLOAD_DIR ?? "uploads"),
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024,
  // Límite de la foto que se sube; la que se guarda pesa unos pocos KB tras optimizarla.
  maxAvatarSizeBytes: Number(process.env.MAX_AVATAR_SIZE_MB ?? 8) * 1024 * 1024,
  // Consultas SQL que se registran como lentas (0 desactiva el registro).
  slowQueryMs: Number(process.env.SLOW_QUERY_MS ?? 20),
  // Límites por cada 15 minutos (ver middleware/security.js).
  rateLimitApi: Number(process.env.RATE_LIMIT_API ?? 1500), // peticiones de cada usuario con sesión
  rateLimitAnonymous: Number(process.env.RATE_LIMIT_ANONYMOUS ?? 1500), // peticiones sin sesión por IP
  rateLimitAuth: Number(process.env.RATE_LIMIT_AUTH ?? 25), // intentos fallidos por cuenta
  rateLimitAuthIp: Number(process.env.RATE_LIMIT_AUTH_IP ?? 500), // intentos fallidos por IP
  // Compresión en Node. Desactívala (false) si un proxy o CDN delante ya comprime.
  compression: process.env.COMPRESSION !== "false",
  serveClient: process.env.SERVE_CLIENT === "true",
  clientDist: fromServerRoot(process.env.CLIENT_DIST ?? "../client/dist"),
});

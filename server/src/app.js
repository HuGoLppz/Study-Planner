import path from "node:path";
import zlib from "node:zlib";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import {
  anonymousLimiter,
  verifyOrigin,
  warnUntrustedProxy,
} from "./middleware/security.js";
import { apiRouter } from "./routes/index.js";
import { ApiError } from "./utils/ApiError.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "blob:"],
          "connect-src": ["'self'", ...env.clientOrigins],
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientOrigins.includes(origin))
          return callback(null, true);
        return callback(
          ApiError.forbidden("Origen no permitido", "ORIGIN_REJECTED"),
        );
      },
      credentials: true,
    }),
  );
  // gzip/brotli de JSON y del frontend: las respuestas ocupan entre 3 y 4 veces menos. Brotli con
  // calidad 4: la 11 (la de por defecto) cuesta tanta CPU que ralentiza toda la API.
  if (env.compression)
    app.use(
      compression({
        brotli: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } },
      }),
    );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  if (!env.isProduction) app.use(morgan("dev"));

  app.use(
    "/api",
    warnUntrustedProxy,
    anonymousLimiter,
    verifyOrigin,
    apiRouter,
  );
  app.use("/api", notFound);

  // Despliegue en un único servicio: Express sirve también el frontend compilado.
  // Los archivos de assets/ llevan un hash en el nombre: si cambian, cambia la URL, así que se
  // cachean un año. index.html se revalida siempre para recoger cada despliegue.
  if (env.serveClient) {
    const assets = `${path.sep}assets${path.sep}`;
    app.use(
      express.static(env.clientDist, {
        index: false,
        setHeaders: (res, filePath) =>
          res.set(
            "Cache-Control",
            filePath.includes(assets)
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          ),
      }),
    );
    app.get("/{*splat}", (_req, res) =>
      res
        .set("Cache-Control", "no-cache")
        .sendFile(path.join(env.clientDist, "index.html")),
    );
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

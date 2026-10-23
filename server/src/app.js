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

// La política de contenido solo abre lo que hace falta; los scripts de Google y Apple, únicamente si
// ese inicio de sesión está configurado.
function contentSecurityPolicy() {
  const directives = {
    "img-src": ["'self'", "data:", "blob:"],
    "connect-src": ["'self'", ...env.clientOrigins],
  };
  if (env.oauth.google) {
    directives["script-src"] = ["'self'", "https://accounts.google.com/gsi/client"];
    directives["frame-src"] = ["https://accounts.google.com/gsi/"];
    directives["connect-src"].push("https://accounts.google.com/gsi/");
    directives["style-src"] = ["'self'", "https:", "'unsafe-inline'"];
  }
  if (env.oauth.apple) {
    directives["script-src"] = [
      ...(directives["script-src"] ?? ["'self'"]),
      "https://appleid.cdn-apple.com",
    ];
    directives["connect-src"].push("https://appleid.apple.com");
  }
  return directives;
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: contentSecurityPolicy() },
      // Los popups de Google y Apple devuelven el token a la ventana que los abrió.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    }),
  );
  // Con SERVE_CLIENT la web llega del mismo origen que la API, y el navegador también manda Origin
  // al pedir sus scripts y estilos: el origen propio se admite siempre, como en verifyOrigin.
  app.use(
    cors((req, callback) => {
      const origin = req.get("origin");
      const selfOrigin = `${req.protocol}://${req.get("host")}`;
      if (!origin || origin === selfOrigin || env.clientOrigins.includes(origin))
        return callback(null, { origin: true, credentials: true });
      return callback(
        ApiError.forbidden("Origen no permitido", "ORIGIN_REJECTED"),
      );
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

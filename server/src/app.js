import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter, verifyOrigin } from './middleware/security.js';
import { apiRouter } from './routes/index.js';
import { ApiError } from './utils/ApiError.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'", ...env.clientOrigins],
        },
      },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
        return callback(ApiError.forbidden('Origen no permitido', 'ORIGIN_REJECTED'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isProduction) app.use(morgan('dev'));

  app.use('/api', apiLimiter, verifyOrigin, apiRouter);
  app.use('/api', notFound);

  // Despliegue en un único servicio: Express sirve también el frontend compilado.
  if (env.serveClient) {
    app.use(express.static(env.clientDist, { index: false, maxAge: '7d' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(env.clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

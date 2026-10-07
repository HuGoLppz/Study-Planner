import mongoose from 'mongoose';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([key, value]) => [key, value.message]));
    return ApiError.unprocessable('Revisa los datos enviados', fields);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest('Identificador no válido', 'INVALID_ID');
  }
  if (err?.code === 11000) {
    return ApiError.conflict('Ese valor ya está en uso', 'DUPLICATE', { fields: err.keyValue });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(413, 'El archivo supera el tamaño máximo permitido', 'FILE_TOO_LARGE');
    }
    return ApiError.badRequest('No se ha podido procesar el archivo', err.code);
  }
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('El cuerpo de la petición no es JSON válido', 'INVALID_JSON');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'La petición es demasiado grande', 'PAYLOAD_TOO_LARGE');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const apiError = normalize(err);

  if (!apiError) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({
      error: {
        message: 'Algo ha fallado en el servidor. Inténtalo de nuevo en unos segundos.',
        code: 'INTERNAL_ERROR',
        ...(env.isProduction ? {} : { debug: err?.message }),
      },
    });
  }

  if (apiError.status >= 500) logger.error(apiError);

  return res.status(apiError.status).json({
    error: { message: apiError.message, code: apiError.code, ...apiError.extra },
  });
}

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No existe la ruta ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

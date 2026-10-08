import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

function normalize(err) {
  if (err instanceof ApiError) return err;

  // Errores de PostgreSQL (SQLSTATE) que se saltan las comprobaciones previas, p. ej. dos peticiones
  // a la vez. Ver https://www.postgresql.org/docs/current/errcodes-appendix.html
  switch (err?.code) {
    case "23505": // unique_violation
      return ApiError.conflict("Ese valor ya está en uso", "DUPLICATE");
    case "P0001": // RAISE EXCEPTION de los triggers del esquema: su mensaje ya está en español
      return ApiError.conflict(err.message, "CONSTRAINT");
    case "23502": // not_null_violation
    case "23503": // foreign_key_violation
    case "23514": // check_violation
    case "22001": // string_data_right_truncation
    case "22P02": // invalid_text_representation
      return ApiError.unprocessable(
        "Revisa los datos enviados",
        undefined,
        "CONSTRAINT",
      );
    case "40001": // serialization_failure
    case "40P01": // deadlock_detected
    case "57014": // query_canceled (statement_timeout)
    case "53300": // too_many_connections
      return new ApiError(
        503,
        "El servidor está ocupado. Inténtalo de nuevo en unos segundos.",
        "DATABASE_BUSY",
      );
    default:
      break;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return new ApiError(
        413,
        "El archivo supera el tamaño máximo permitido",
        "FILE_TOO_LARGE",
      );
    }
    return ApiError.badRequest("No se ha podido procesar el archivo", err.code);
  }
  if (err?.type === "entity.parse.failed") {
    return ApiError.badRequest(
      "El cuerpo de la petición no es JSON válido",
      "INVALID_JSON",
    );
  }
  if (err?.type === "entity.too.large") {
    return new ApiError(
      413,
      "La petición es demasiado grande",
      "PAYLOAD_TOO_LARGE",
    );
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
        message:
          "Algo ha fallado en el servidor. Inténtalo de nuevo en unos segundos.",
        code: "INTERNAL_ERROR",
        ...(env.isProduction ? {} : { debug: err?.message }),
      },
    });
  }

  if (apiError.status >= 500) logger.error(apiError);

  return res.status(apiError.status).json({
    error: {
      message: apiError.message,
      code: apiError.code,
      ...apiError.extra,
    },
  });
}

export function notFound(req, _res, next) {
  next(
    ApiError.notFound(
      `No existe la ruta ${req.method} ${req.originalUrl}`,
      "ROUTE_NOT_FOUND",
    ),
  );
}

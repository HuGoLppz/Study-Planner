// Error de dominio con estado HTTP. El middleware de errores lo convierte en
// { error: { message, code, fields? } }.
export class ApiError extends Error {
  constructor(status, message, code = 'ERROR', extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }

  static badRequest(message, code = 'BAD_REQUEST', extra) {
    return new ApiError(400, message, code, extra);
  }

  static unauthorized(message = 'Necesitas iniciar sesión', code = 'UNAUTHENTICATED') {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'No tienes permiso para hacer esto', code = 'FORBIDDEN', extra) {
    return new ApiError(403, message, code, extra);
  }

  static notFound(message = 'No encontrado', code = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = 'CONFLICT', extra) {
    return new ApiError(409, message, code, extra);
  }

  static unprocessable(message, fields, code = 'VALIDATION_ERROR') {
    return new ApiError(422, message, code, { fields });
  }
}

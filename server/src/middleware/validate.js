import { ApiError } from "../utils/ApiError.js";

// Valida body, query y params con un esquema zod de la forma z.object({ body, query, params }).
// Solo los datos validados (y sin claves desconocidas) llegan al controlador en req.valid.
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body ?? {},
    query: req.query ?? {},
    params: req.params ?? {},
  });

  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.slice(1).join(".") || issue.path[0];
      if (!fields[key]) fields[key] = issue.message;
    }
    throw ApiError.unprocessable("Revisa los datos enviados", fields);
  }

  req.valid = result.data;
  next();
};

import { z } from "zod";
import { PUBLIC_ID_PATTERN } from "../utils/ids.js";

// Mensajes de validación en español para todo el servidor.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message:
          issue.received === "undefined"
            ? "Este campo es obligatorio"
            : "Tipo de dato no válido",
      };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return {
          message:
            issue.minimum === 1
              ? "Este campo es obligatorio"
              : `Debe tener al menos ${issue.minimum} caracteres`,
        };
      }
      if (issue.type === "array")
        return { message: `Selecciona al menos ${issue.minimum}` };
      return { message: `Debe ser mayor o igual que ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string")
        return { message: `Como máximo ${issue.maximum} caracteres` };
      if (issue.type === "array")
        return { message: `Como máximo ${issue.maximum} elementos` };
      return { message: `Debe ser menor o igual que ${issue.maximum}` };
    case z.ZodIssueCode.invalid_string:
      return {
        message:
          issue.validation === "email"
            ? "Introduce un correo válido"
            : "Formato no válido",
      };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Opción no válida" };
    case z.ZodIssueCode.invalid_date:
      return { message: "Fecha no válida" };
    default:
      return { message: ctx.defaultError };
  }
});

export { z };

// Usuarios y salas tienen un identificador público de 9 caracteres; el resto de filas, un entero.
export const publicId = z
  .string()
  .regex(PUBLIC_ID_PATTERN, "Identificador no válido");
export const numericId = z.coerce
  .string()
  .regex(/^[1-9]\d{0,15}$/, "Identificador no válido")
  .transform(Number);
export const date = z.coerce.date();
export const dayKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
export const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
export const pageLimit = (max = 100, fallback = 20) =>
  z.coerce.number().int().min(1).max(max).default(fallback);

// Construye el esquema que espera el middleware validate().
export const request = ({ body, query, params } = {}) =>
  z.object({
    body: body ?? z.any(),
    query: query ?? z.any(),
    params: params ?? z.any(),
  });

const PUBLIC_ID_PARAMS = new Set(["userId", "roomId"]);

export const idParams = (...names) =>
  z.object(
    Object.fromEntries(
      names.map((name) => [
        name,
        PUBLIC_ID_PARAMS.has(name) ? publicId : numericId,
      ]),
    ),
  );

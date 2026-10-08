import crypto from "node:crypto";
import { sql } from "../database/db.js";
import { tokenize } from "../utils/text.js";

const handleExists = async (handle) =>
  Boolean(
    await sql("SELECT 1 FROM Usuarios WHERE identificador = ?").get(handle),
  );

// "Hugo López Sanz" → "hugo.lopez". Si está ocupado, añade un número aleatorio.
export function baseHandleFrom(name) {
  const tokens = tokenize(name);
  const parts = tokens.length > 1 ? [tokens[0], tokens[1]] : tokens;
  const base = parts.join(".").slice(0, 24);
  return base.length >= 3 ? base : `estudiante${base}`;
}

export async function generateUniqueHandle(name) {
  const base = baseHandleFrom(name);
  if (!(await handleExists(base))) return base;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `${base}${crypto.randomInt(10, attempt < 6 ? 999 : 99999)}`;
    if (!(await handleExists(candidate))) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

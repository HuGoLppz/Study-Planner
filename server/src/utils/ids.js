import crypto from "node:crypto";

// Identificadores públicos de usuarios y salas: 9 caracteres sin 0/O ni 1/I para que se
// puedan dictar o copiar a mano. 32^9 ≈ 3,5·10^13 combinaciones.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PUBLIC_ID_PATTERN = /^[2-9A-HJ-NP-Z]{9}$/;

export function generatePublicId() {
  const bytes = crypto.randomBytes(9);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export const isPublicId = (value) =>
  typeof value === "string" && PUBLIC_ID_PATTERN.test(value);

export const sameId = (a, b) =>
  a != null && b != null && String(a) === String(b);

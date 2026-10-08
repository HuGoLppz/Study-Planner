import bcrypt from "bcrypt";

const COST = 12;

// bcrypt nativo: el hash se calcula en el pool de hilos de libuv, no en el hilo principal, así que
// un pico de inicios de sesión no bloquea al resto de usuarios. Es compatible con los hashes $2b$
// generados antes con bcryptjs.

// Hash con el que comparar cuando el usuario no existe, para que la respuesta tarde lo mismo
// y no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync("study-planner-timing-guard", COST);

export function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}

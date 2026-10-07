import bcrypt from 'bcryptjs';

const COST = 12;

// Hash con el que comparar cuando el usuario no existe, para que la respuesta tarde lo mismo
// y no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('study-planner-timing-guard', COST);

export function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}

import { hashPassword, verifyPassword } from "../auth/password.js";
import { nowIso, sql, transaction } from "../database/db.js";
import { loadUser } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { generatePublicId } from "../utils/ids.js";
import { searchableName } from "../utils/text.js";
import { generateUniqueHandle } from "./handle.service.js";

const EMAIL_TAKEN = "Ya existe una cuenta con ese correo";

export async function registerUser({
  name,
  email,
  password,
  studies,
  course,
  bio,
}) {
  if (await sql("SELECT 1 FROM Usuarios WHERE email = ?").get(email)) {
    throw ApiError.conflict(EMAIL_TAKEN, "EMAIL_TAKEN", {
      fields: { email: EMAIL_TAKEN },
    });
  }

  const [passwordHash, handle] = await Promise.all([
    hashPassword(password),
    generateUniqueHandle(name),
  ]);
  const userId = generatePublicId();

  // El usuario y sus ajustes de Pomodoro se crean juntos o no se crea nada.
  await transaction(async () => {
    await sql(
      `INSERT INTO Usuarios (usuario_id, nombre, nombre_busqueda, email, password, identificador, estudios, curso, descripcion)
       VALUES (@userId, @name, @search, @email, @passwordHash, @handle, @studies, @course, @bio)`,
    ).run({
      userId,
      name,
      search: searchableName(name),
      email,
      passwordHash,
      handle,
      studies,
      course,
      bio,
    });
    await sql("INSERT INTO Ajustes_Pomodoro (usuario_id) VALUES (?)").run(
      userId,
    );
  });
  return loadUser(userId);
}

export async function loginUser({ email, password }) {
  const row = await sql(
    "SELECT usuario_id, password FROM Usuarios WHERE email = ?",
  ).get(email);
  const valid = await verifyPassword(password, row?.password);

  if (!row || !valid) {
    throw ApiError.unauthorized(
      "El correo o la contraseña no son correctos",
      "INVALID_CREDENTIALS",
    );
  }
  return loadUser(row.usuario_id);
}

// Cambiar la contraseña invalida todas las sesiones abiertas (version_sesion).
export async function changePassword(userId, { currentPassword, newPassword }) {
  const { password } = await sql(
    "SELECT password FROM Usuarios WHERE usuario_id = ?",
  ).get(userId);
  if (!(await verifyPassword(currentPassword, password))) {
    throw ApiError.unprocessable("La contraseña actual no es correcta", {
      currentPassword: "La contraseña actual no es correcta",
    });
  }

  const passwordHash = await hashPassword(newPassword);
  await sql(
    "UPDATE Usuarios SET password = ?, version_sesion = version_sesion + 1, fecha_actualizacion = ? WHERE usuario_id = ?",
  ).run(passwordHash, nowIso(), userId);
  return loadUser(userId);
}

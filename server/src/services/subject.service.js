import { LIMITS } from "../config/constants.js";
import { nowIso, sql } from "../database/db.js";
import { toSubject } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { normalizeText } from "../utils/text.js";
import { invalidateAcademic } from "./academicCache.js";

// La restricción UNIQUE (usuario_id, nombre_normalizado) lo garantiza; esto da el error del campo.
function assertUniqueName(user, name, exceptId = null) {
  const target = normalizeText(name);
  const duplicate = user.subjects.some(
    (subject) =>
      !sameId(subject._id, exceptId) && normalizeText(subject.name) === target,
  );
  if (duplicate) {
    throw ApiError.conflict(
      "Ya tienes una asignatura con ese nombre",
      "SUBJECT_DUPLICATE",
      {
        fields: { name: "Ya tienes una asignatura con ese nombre" },
      },
    );
  }
}

function findSubject(user, subjectId) {
  const subject = user.subjects.find((item) => sameId(item._id, subjectId));
  if (!subject)
    throw ApiError.notFound("Esta asignatura no existe", "SUBJECT_NOT_FOUND");
  return subject;
}

const getSubject = async (subjectId) =>
  toSubject(
    await sql("SELECT * FROM Asignaturas WHERE asignatura_id = ?").get(
      subjectId,
    ),
  );

export async function createSubject(user, { name, description, color }) {
  if (user.subjects.length >= LIMITS.subjectsPerUser) {
    throw ApiError.conflict(
      `Has llegado al máximo de ${LIMITS.subjectsPerUser} asignaturas`,
      "SUBJECT_LIMIT",
    );
  }
  assertUniqueName(user, name);

  const { lastInsertRowid } = await sql(
    `INSERT INTO Asignaturas (usuario_id, nombre_asignatura, nombre_normalizado, color, descripcion)
     VALUES (?, ?, ?, ?, ?) RETURNING asignatura_id`,
  ).run(user._id, name, normalizeText(name), color, description);
  invalidateAcademic(user._id);
  return getSubject(lastInsertRowid);
}

export async function updateSubject(user, subjectId, data) {
  const subject = findSubject(user, subjectId);
  if (data.name) assertUniqueName(user, data.name, subjectId);

  const next = {
    ...subject,
    ...Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ),
  };
  await sql(
    `UPDATE Asignaturas SET nombre_asignatura = ?, nombre_normalizado = ?, color = ?, descripcion = ?, fecha_actualizacion = ?
      WHERE asignatura_id = ? AND usuario_id = ?`,
  ).run(
    next.name,
    normalizeText(next.name),
    next.color,
    next.description,
    nowIso(),
    subjectId,
    user._id,
  );
  invalidateAcademic(user._id);
  return getSubject(subjectId);
}

// Sus tareas no se borran: se quedan sin asignatura (FOREIGN KEY ... ON DELETE SET NULL).
export async function deleteSubject(user, subjectId) {
  findSubject(user, subjectId);
  await sql(
    "DELETE FROM Asignaturas WHERE asignatura_id = ? AND usuario_id = ?",
  ).run(subjectId, user._id);
  invalidateAcademic(user._id);
}

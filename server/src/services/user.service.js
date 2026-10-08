import { nowIso, sql } from "../database/db.js";
import { loadUser, summaryColumns, summaryFrom } from "../models/user.model.js";
import {
  AVATAR_EXTENSION,
  AVATAR_MIME,
  toAvatarImage,
} from "../uploads/images.js";
import {
  readAvatarFile,
  removeAvatarFile,
  storeAvatar,
} from "../uploads/storage.js";
import { ApiError } from "../utils/ApiError.js";
import { sameId } from "../utils/ids.js";
import { escapeLike, searchableName, tokenize } from "../utils/text.js";
import { countFriends, relationshipMap } from "./friend.service.js";
import { computeAcademicStats } from "./grade.service.js";

// Actualiza solo las columnas recibidas y devuelve el usuario completo.
async function updateUser(userId, columns) {
  const set = { ...columns, fecha_actualizacion: nowIso() };
  const assignments = Object.keys(set)
    .map((column) => `${column} = @${column}`)
    .join(", ");
  await sql(
    `UPDATE Usuarios SET ${assignments} WHERE usuario_id = @userId`,
  ).run({ ...set, userId });
  return loadUser(userId);
}

const PROFILE_COLUMNS = {
  name: "nombre",
  handle: "identificador",
  studies: "estudios",
  course: "curso",
  bio: "descripcion",
};

export async function updateProfile(user, data) {
  if (data.handle && data.handle !== user.handle) {
    const taken = await sql(
      "SELECT 1 FROM Usuarios WHERE identificador = ? AND usuario_id <> ?",
    ).get(data.handle, user._id);
    if (taken) {
      throw ApiError.conflict(
        "Ese identificador ya está en uso",
        "HANDLE_TAKEN",
        {
          fields: { handle: "Ese identificador ya está en uso" },
        },
      );
    }
  }

  const columns = {};
  for (const [field, column] of Object.entries(PROFILE_COLUMNS)) {
    if (data[field] !== undefined) columns[column] = data[field];
  }
  if (data.name !== undefined)
    columns.nombre_busqueda = searchableName(data.name);
  return updateUser(user._id, columns);
}

export function updatePrivacy(user, data) {
  const columns = {};
  if (data.profileVisibility !== undefined)
    columns.visibilidad_perfil = data.profileVisibility;
  if (data.searchable !== undefined) columns.buscable = data.searchable;
  if (data.showGrades !== undefined) columns.mostrar_notas = data.showGrades;
  return updateUser(user._id, columns);
}

export function updatePreferences(user, data) {
  return updateUser(user._id, data.theme ? { tema: data.theme } : {});
}

// Búsqueda por identificador (@handle) o por nombre.
// El identificador exacto encuentra a cualquiera; el resto respeta "aparecer en búsquedas".
// Los LIKE '%…%' usan los índices de trigramas (pg_trgm) de nombre_busqueda e identificador.
export async function searchUsers(viewer, { q, limit }) {
  const raw = q.trim();
  const handleQuery = raw.replace(/^@/, "").toLowerCase();
  const params = {
    me: viewer._id,
    limit,
    handle: handleQuery,
    handlePrefix: `${escapeLike(handleQuery)}%`,
  };
  const conditions = [];

  if (/^[a-z0-9._]{2,30}$/.test(handleQuery)) {
    conditions.push("u.identificador = @handle");
    conditions.push(
      "(u.buscable AND u.identificador LIKE @handlePrefix ESCAPE '\\')",
    );
  }

  // Cada palabra buscada tiene que ser el principio de alguna palabra del nombre.
  const tokens = tokenize(raw);
  if (!raw.startsWith("@") && tokens.length > 0) {
    const byName = tokens.map((token, index) => {
      params[`token${index}`] = `% ${escapeLike(token)}%`;
      return `(' ' || u.nombre_busqueda) LIKE @token${index} ESCAPE '\\'`;
    });
    conditions.push(`(u.buscable AND ${byName.join(" AND ")})`);
  }
  if (conditions.length === 0) return [];

  const rows = await sql(
    `SELECT ${summaryColumns("u", "user")}, u.estudios, u.curso
       FROM Usuarios u
      WHERE u.usuario_id <> @me AND (${conditions.join(" OR ")})
      LIMIT @limit`,
  ).all(params);

  const relationships = await relationshipMap(
    viewer._id,
    rows.map((row) => row.user_id),
  );

  return rows
    .map((row) => ({
      ...summaryFrom(row, "user"),
      studies: row.estudios,
      course: row.curso,
      relationship: relationships.get(row.user_id),
    }))
    .sort((a, b) => {
      if (a.handle === handleQuery) return -1;
      if (b.handle === handleQuery) return 1;
      return a.name.localeCompare(b.name, "es");
    });
}

// Perfil visto por otra persona. La privacidad decide qué partes se incluyen.
export async function getProfile(viewer, handle) {
  const row = await sql(
    "SELECT usuario_id FROM Usuarios WHERE identificador = ?",
  ).get(handle);
  if (!row)
    throw ApiError.notFound(
      "No hay ningún estudiante con ese identificador",
      "USER_NOT_FOUND",
    );
  const user = await loadUser(row.usuario_id);

  const isSelf = sameId(viewer._id, user._id);
  const relationship = isSelf
    ? { status: "self" }
    : (await relationshipMap(viewer._id, [user._id])).get(user._id);

  const { profileVisibility, showGrades } = user.privacy;
  const canView =
    isSelf ||
    profileVisibility === "public" ||
    (profileVisibility === "friends" && relationship.status === "friends");

  const profile = {
    _id: user._id,
    name: user.name,
    handle: user.handle,
    avatar: user.avatar ? { updatedAt: user.avatar.updatedAt } : null,
    relationship,
    visibility: profileVisibility,
    restricted: !canView,
  };
  if (!canView) return profile;

  const withStats = isSelf || showGrades;
  const [friendsCount, stats] = await Promise.all([
    countFriends(user._id),
    withStats ? computeAcademicStats(user) : null,
  ]);
  Object.assign(profile, {
    studies: user.studies,
    course: user.course,
    bio: user.bio,
    memberSince: user.createdAt,
    subjects: user.subjects.map((subject) => ({
      _id: subject._id,
      name: subject.name,
      color: subject.color,
    })),
    friendsCount,
  });

  if (stats) {
    profile.stats = {
      average: stats.average,
      totals: stats.totals,
      bySubject: stats.bySubject
        .filter((item) => item.subject)
        .map(({ subject, average, progress, graded }) => ({
          subject,
          average,
          progress,
          graded,
        })),
    };
  }
  return profile;
}

// La foto se guarda ya optimizada (WebP 256×256 sin metadatos); el original nunca se guarda.
export async function setAvatar(user, file) {
  const image = await toAvatarImage(file.buffer);
  const fileName = await storeAvatar(image, AVATAR_EXTENSION, AVATAR_MIME);
  const previous = user.avatar?.fileName;

  let updated;
  try {
    updated = await updateUser(user._id, {
      foto_perfil: fileName,
      foto_actualizada: nowIso(),
    });
  } catch (error) {
    await removeAvatarFile(fileName);
    throw error;
  }
  if (previous) await removeAvatarFile(previous);
  return updated;
}

export async function removeAvatar(user) {
  const previous = user.avatar?.fileName;
  const updated = await updateUser(user._id, {
    foto_perfil: null,
    foto_actualizada: null,
  });
  if (previous) await removeAvatarFile(previous);
  return updated;
}

export async function getAvatarFile(userId) {
  const row = await sql(
    "SELECT foto_perfil FROM Usuarios WHERE usuario_id = ?",
  ).get(userId);
  if (!row?.foto_perfil)
    throw ApiError.notFound("Este estudiante no tiene foto");

  const stream = await readAvatarFile(row.foto_perfil);
  if (!stream) throw ApiError.notFound("La foto ya no está disponible");
  return { stream, mimeType: AVATAR_MIME };
}

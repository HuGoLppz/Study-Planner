import { iso, sql } from "../database/db.js";

export const AVATAR_MIME_TYPE = "image/webp";

// Columnas de un usuario resumido (nombre, identificador y foto) unido con alias a otra tabla.
// summaryColumns('a', 'actor') → a.usuario_id AS actor_id, a.nombre AS actor_name…
export const summaryColumns = (alias, prefix) =>
  `${alias}.usuario_id AS ${prefix}_id, ${alias}.nombre AS ${prefix}_name, ` +
  `${alias}.identificador AS ${prefix}_handle, ${alias}.foto_actualizada AS ${prefix}_avatar`;

// Resumen público listo para la respuesta. null si la persona ya no existe.
export function summaryFrom(row, prefix) {
  const id = row[`${prefix}_id`];
  if (id == null) return null;
  const avatar = row[`${prefix}_avatar`];
  return {
    _id: id,
    name: row[`${prefix}_name`],
    handle: row[`${prefix}_handle`],
    avatar: avatar ? { updatedAt: avatar } : null,
  };
}

// Sirve para filas normales y para las que llegan dentro de un json_agg (fechas en otro formato).
export function toSubject(row) {
  return {
    _id: String(row.asignatura_id),
    name: row.nombre_asignatura,
    description: row.descripcion,
    color: row.color,
    createdAt: iso(row.fecha_creacion),
    updatedAt: iso(row.fecha_actualizacion),
  };
}

export async function listSubjects(userId) {
  const rows = await sql(
    "SELECT * FROM Asignaturas WHERE usuario_id = ? ORDER BY fecha_creacion, asignatura_id",
  ).all(userId);
  return rows.map(toSubject);
}

// Usuario completo (sin el hash de la contraseña) con sus asignaturas y ajustes de Pomodoro, en
// una sola consulta: es lo que queda en req.user en cada petición autenticada.
export async function loadUser(userId) {
  const row = await sql(
    `SELECT u.*, p.minutos_trabajo, p.minutos_descanso, p.minutos_descanso_largo, p.ciclos_descanso_largo,
            COALESCE((SELECT json_agg(a ORDER BY a.fecha_creacion, a.asignatura_id)
                        FROM Asignaturas a WHERE a.usuario_id = u.usuario_id), '[]') AS asignaturas
       FROM Usuarios u LEFT JOIN Ajustes_Pomodoro p ON p.usuario_id = u.usuario_id
      WHERE u.usuario_id = ?`,
  ).get(userId);
  if (!row) return null;

  return {
    _id: row.usuario_id,
    name: row.nombre,
    email: row.email,
    handle: row.identificador,
    tokenVersion: row.version_sesion,
    studies: row.estudios,
    course: row.curso,
    bio: row.descripcion,
    avatar: row.foto_perfil
      ? {
          fileName: row.foto_perfil,
          mimeType: AVATAR_MIME_TYPE,
          updatedAt: row.foto_actualizada,
        }
      : null,
    privacy: {
      profileVisibility: row.visibilidad_perfil,
      searchable: row.buscable,
      showGrades: row.mostrar_notas,
    },
    preferences: {
      theme: row.tema,
      pomodoro: {
        focusMinutes: row.minutos_trabajo ?? 25,
        breakMinutes: row.minutos_descanso ?? 5,
        longBreakMinutes: row.minutos_descanso_largo ?? 15,
        cyclesBeforeLongBreak: row.ciclos_descanso_largo ?? 4,
      },
    },
    subjects: row.asignaturas.map(toSubject),
    createdAt: row.fecha_registro,
  };
}

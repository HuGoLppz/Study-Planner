import { LIMITS } from "../config/constants.js";
import { iso, lockRow, sql, transaction } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { assertOwnSubject } from "./task.service.js";

const TOTALS_SQL = `
  COALESCE(SUM(segundos_reales) FILTER (WHERE fase = 'focus'), 0) AS "focusSeconds",
  COALESCE(SUM(segundos_reales) FILTER (WHERE fase = 'break'), 0) AS "breakSeconds",
  COUNT(*) FILTER (WHERE fase = 'focus' AND completada) AS "completedFocus"`;

export function getSettings(user) {
  return user.preferences.pomodoro;
}

export async function updateSettings(user, settings) {
  await sql(
    `INSERT INTO Ajustes_Pomodoro (usuario_id, minutos_trabajo, minutos_descanso, minutos_descanso_largo, ciclos_descanso_largo)
     VALUES (@userId, @focusMinutes, @breakMinutes, @longBreakMinutes, @cyclesBeforeLongBreak)
     ON CONFLICT (usuario_id) DO UPDATE SET
       minutos_trabajo = excluded.minutos_trabajo,
       minutos_descanso = excluded.minutos_descanso,
       minutos_descanso_largo = excluded.minutos_descanso_largo,
       ciclos_descanso_largo = excluded.ciclos_descanso_largo`,
  ).run({ userId: user._id, ...settings });
  return settings;
}

export async function getDay(userId, day) {
  const rows = await sql(
    "SELECT * FROM Pomodoro WHERE usuario_id = ? AND dia = ? ORDER BY fecha_inicio, pomodoro_id",
  ).all(userId, day);
  const sessions = rows.map((row) => ({
    phase: row.fase,
    plannedSeconds: row.segundos_previstos,
    actualSeconds: row.segundos_reales,
    completed: row.completada,
    startedAt: row.fecha_inicio,
    endedAt: row.fecha_fin,
    subject: row.asignatura_id == null ? null : String(row.asignatura_id),
  }));

  const totals = { focusSeconds: 0, breakSeconds: 0, completedFocus: 0 };
  for (const session of sessions) {
    if (session.phase === "focus") {
      totals.focusSeconds += session.actualSeconds;
      if (session.completed) totals.completedFocus += 1;
    } else {
      totals.breakSeconds += session.actualSeconds;
    }
  }
  return { day, sessions, totals };
}

export async function logSession(user, { day, subjectId, ...session }) {
  assertOwnSubject(user, subjectId);

  // Contar e insertar con el usuario bloqueado: dos sesiones simultáneas no pueden saltarse el límite.
  await transaction(async () => {
    await lockRow("usuario", user._id);
    const { count } = await sql(
      "SELECT COUNT(*) AS count FROM Pomodoro WHERE usuario_id = ? AND dia = ?",
    ).get(user._id, day);
    if (count >= LIMITS.sessionsPerDay) {
      throw ApiError.conflict(
        "Has llegado al máximo de sesiones registradas hoy",
        "POMODORO_DAY_FULL",
      );
    }
    await sql(
      `INSERT INTO Pomodoro (usuario_id, dia, fase, segundos_previstos, segundos_reales, completada, asignatura_id, fecha_inicio, fecha_fin)
       VALUES (@userId, @day, @phase, @plannedSeconds, @actualSeconds, @completed, @subjectId, @startedAt, @endedAt)`,
    ).run({
      userId: user._id,
      day,
      subjectId,
      phase: session.phase,
      plannedSeconds: session.plannedSeconds,
      actualSeconds: session.actualSeconds,
      completed: session.completed,
      startedAt: iso(session.startedAt),
      endedAt: iso(session.endedAt),
    });
  });
  return getDay(user._id, day);
}

// Totales por día (solo los días con alguna sesión).
export function getHistory(userId, { from, to }) {
  return sql(
    `SELECT dia AS day, ${TOTALS_SQL}
       FROM Pomodoro WHERE usuario_id = ? AND dia BETWEEN ? AND ?
      GROUP BY dia ORDER BY dia`,
  ).all(userId, from, to);
}

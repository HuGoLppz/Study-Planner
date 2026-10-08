// Tarea personal con su nota (LEFT JOIN: la calificación es opcional y 1:1).
export const TASK_SELECT = `
  SELECT t.*, c.calificacion, c.fecha_registro AS fecha_calificacion
    FROM Tareas t LEFT JOIN Calificaciones c ON c.tarea_id = t.tarea_id`;

export function toTask(row) {
  return {
    _id: String(row.tarea_id),
    owner: row.usuario_id,
    title: row.titulo,
    description: row.descripcion,
    subject: row.asignatura_id == null ? null : String(row.asignatura_id),
    type: row.tipo_actividad,
    priority: row.urgencia,
    status: row.estado,
    dueDate: row.fecha_entrega,
    completedAt: row.fecha_completada,
    grade:
      row.calificacion == null
        ? undefined
        : { score: row.calificacion, gradedAt: row.fecha_calificacion },
    createdAt: row.fecha_creacion,
    updatedAt: row.fecha_actualizacion,
  };
}

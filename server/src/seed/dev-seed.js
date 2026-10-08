// Datos de demostración SOLO para desarrollo. Nunca se ejecuta automáticamente.
//   npm run seed        crea las cuentas de demo (correo @demo.study-planner.local)
//   npm run seed:clear  elimina todo lo creado por el seed
// Las cuentas de demo son reconocibles por su dominio y se borran sin tocar datos reales.
import { hashPassword } from "../auth/password.js";
import { env } from "../config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
  sql,
  transaction,
} from "../database/db.js";
import { removeRoomFiles } from "../uploads/storage.js";
import { generatePublicId } from "../utils/ids.js";
import { logger } from "../utils/logger.js";
import { normalizeText, searchableName } from "../utils/text.js";

const DOMAIN = "@demo.study-planner.local";
const PASSWORD = process.env.SEED_PASSWORD ?? "demo12345";
const DAY = 24 * 60 * 60 * 1000;

const at = (days, hour = 23, minute = 59) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const dayKey = (iso) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// ON DELETE CASCADE se lleva todo lo que cuelga de las cuentas de demo: tareas, notas,
// amistades, salas que crearon (y su contenido), mensajes, avisos y sesiones de Pomodoro.
async function clear() {
  const users = (
    await sql("SELECT usuario_id FROM Usuarios WHERE email LIKE ?").all(
      `%${DOMAIN}`,
    )
  ).map((row) => row.usuario_id);
  if (users.length === 0) return 0;

  const rooms = await sql(
    "SELECT sala_id FROM Salas WHERE creador_id = ANY(?::text[])",
  ).all(users);
  await transaction(async () => {
    await sql(
      "DELETE FROM Notificaciones WHERE remitente_id = ANY(?::text[])",
    ).run(users);
    await sql("DELETE FROM Salas WHERE creador_id = ANY(?::text[])").run(users);
    await sql("DELETE FROM Usuarios WHERE usuario_id = ANY(?::text[])").run(
      users,
    );
  });
  await Promise.all(rooms.map((room) => removeRoomFiles(room.sala_id)));
  return users.length;
}

async function createUser({ name, local, studies, course, bio, passwordHash }) {
  const userId = generatePublicId();
  await sql(
    `INSERT INTO Usuarios (usuario_id, nombre, nombre_busqueda, email, password, identificador, estudios, curso, descripcion,
                           visibilidad_perfil, buscable, mostrar_notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'friends', true, true)`,
  ).run(
    userId,
    name,
    searchableName(name),
    `${local}${DOMAIN}`,
    passwordHash,
    `demo.${local}`,
    studies,
    course,
    bio,
  );
  await sql("INSERT INTO Ajustes_Pomodoro (usuario_id) VALUES (?)").run(userId);
  return {
    _id: userId,
    name,
    email: `${local}${DOMAIN}`,
    handle: `demo.${local}`,
  };
}

async function createSubject(userId, name, color, description) {
  const { lastInsertRowid } = await sql(
    `INSERT INTO Asignaturas (usuario_id, nombre_asignatura, nombre_normalizado, color, descripcion)
     VALUES (?, ?, ?, ?, ?) RETURNING asignatura_id`,
  ).run(userId, name, normalizeText(name), color, description);
  return lastInsertRowid;
}

async function seed(passwordHash) {
  const lucia = await createUser({
    name: "Lucía Martín Demo",
    local: "lucia",
    studies: "Grado en Ingeniería Informática",
    course: "2º",
    bio: "Cuenta de demostración generada por el seed de desarrollo.",
    passwordHash,
  });
  const marcos = await createUser({
    name: "Marcos Ortega Demo",
    local: "marcos",
    studies: "Grado en Ingeniería Informática",
    course: "2º",
    bio: "Cuenta de demostración.",
    passwordHash,
  });
  const sara = await createUser({
    name: "Sara Gil Demo",
    local: "sara",
    studies: "Grado en Matemáticas",
    course: "3º",
    bio: "Cuenta de demostración.",
    passwordHash,
  });

  const eda = await createSubject(
    lucia._id,
    "Estructuras de datos",
    "pink",
    "Árboles, grafos y tablas hash",
  );
  const calc = await createSubject(
    lucia._id,
    "Cálculo II",
    "yellow",
    "Integrales múltiples",
  );
  const redes = await createSubject(
    lucia._id,
    "Redes",
    "blue",
    "Modelo TCP/IP",
  );
  const bd = await createSubject(
    lucia._id,
    "Bases de datos",
    "mint",
    "Modelado relacional y SQL",
  );

  const done = (days, score) => ({
    status: "completed",
    completedAt: at(days, 18),
    score,
    gradedAt: at(days + 1, 12),
  });
  const tasks = [
    {
      title: "Práctica 1: listas enlazadas",
      subject: eda,
      type: "practice",
      priority: "medium",
      dueDate: at(-40),
      ...done(-41, 7.5),
    },
    {
      title: "Parcial de integrales dobles",
      subject: calc,
      type: "exam",
      priority: "high",
      dueDate: at(-33, 10),
      ...done(-33, 5.8),
    },
    {
      title: "Informe de subredes",
      subject: redes,
      type: "assignment",
      priority: "medium",
      dueDate: at(-26),
      ...done(-27, 8.2),
    },
    {
      title: "Modelo entidad-relación de la biblioteca",
      subject: bd,
      type: "project",
      priority: "high",
      dueDate: at(-19),
      ...done(-20, 9.1),
    },
    {
      title: "Práctica 2: árboles AVL",
      subject: eda,
      type: "practice",
      priority: "high",
      dueDate: at(-12),
      ...done(-12, 6.9),
    },
    {
      title: "Hoja de problemas 3",
      subject: calc,
      type: "assignment",
      priority: "low",
      dueDate: at(-6),
      ...done(-7, 7.2),
    },
    {
      title: "Lectura: capítulo 5 de Kurose",
      subject: redes,
      type: "reading",
      priority: "low",
      dueDate: at(-3),
      ...done(-3),
    },
    {
      title: "Cuestionario de normalización",
      subject: bd,
      type: "assignment",
      priority: "medium",
      dueDate: at(-2),
    },
    {
      title: "Entregar práctica 3: grafos",
      subject: eda,
      type: "practice",
      priority: "high",
      dueDate: at(0, 23, 59),
      status: "in_progress",
    },
    {
      title: "Examen parcial de redes",
      subject: redes,
      type: "exam",
      priority: "high",
      dueDate: at(2, 9, 0),
    },
    {
      title: "Resumen de series de potencias",
      subject: calc,
      type: "reading",
      priority: "low",
      dueDate: at(4),
    },
    {
      title: "Exposición sobre índices",
      subject: bd,
      type: "presentation",
      priority: "medium",
      dueDate: at(6, 11, 30),
    },
    {
      title: "Proyecto final: planificador de rutas",
      subject: eda,
      type: "project",
      priority: "high",
      dueDate: at(11),
    },
    {
      title: "Examen final de cálculo",
      subject: calc,
      type: "exam",
      priority: "high",
      dueDate: at(13, 9, 0),
    },
  ];
  const insertTask = sql(
    `INSERT INTO Tareas (usuario_id, asignatura_id, titulo, tipo_actividad, urgencia, estado, fecha_entrega, fecha_completada,
                         recordatorio_enviado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING tarea_id`,
  );
  const insertGrade = sql(
    "INSERT INTO Calificaciones (tarea_id, calificacion, fecha_registro) VALUES (?, ?, ?)",
  );
  for (const task of tasks) {
    const { lastInsertRowid } = await insertTask.run(
      lucia._id,
      task.subject,
      task.title,
      task.type,
      task.priority,
      task.status ?? "pending",
      task.dueDate,
      task.completedAt ?? null,
      at(-1),
    );
    if (task.score !== undefined)
      await insertGrade.run(lastInsertRowid, task.score, task.gradedAt);
  }

  await sql(
    "INSERT INTO Amigos (usuario_id, amigo_id, estado, fecha_amistad) VALUES (?, ?, 'accepted', ?)",
  ).run(lucia._id, marcos._id, at(-30, 12));
  const { lastInsertRowid: requestId } = await sql(
    "INSERT INTO Amigos (usuario_id, amigo_id) VALUES (?, ?) RETURNING amistad_id",
  ).run(sara._id, lucia._id);

  const roomId = generatePublicId();
  await sql(
    `INSERT INTO Salas (sala_id, nombre, descripcion, fecha_sesion, asignatura_nombre, asignatura_color, creador_id, ultima_actividad)
     VALUES (?, ?, ?, ?, 'Estructuras de datos', 'pink', ?, ?)`,
  ).run(
    roomId,
    "Repaso de estructuras de datos",
    "Preparamos juntos la práctica de grafos y el proyecto final.",
    at(3, 17, 0),
    lucia._id,
    at(0, 9, 15),
  );
  await sql(
    "INSERT INTO Participantes_Salas (sala_id, usuario_id, rol, fecha_union) VALUES (?, ?, 'admin', ?)",
  ).run(roomId, lucia._id, at(-10, 10));
  await sql(
    "INSERT INTO Participantes_Salas (sala_id, usuario_id, rol, fecha_union) VALUES (?, ?, 'member', ?)",
  ).run(roomId, marcos._id, at(-9, 10));

  const insertRoomTask = sql(
    `INSERT INTO Tareas_Sala (sala_id, usuario_id, creador_id, titulo, fecha_entrega, estado, fecha_completada)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  await insertRoomTask.run(
    roomId,
    marcos._id,
    lucia._id,
    "Implementar Dijkstra",
    at(1),
    "in_progress",
    null,
  );
  await insertRoomTask.run(
    roomId,
    lucia._id,
    marcos._id,
    "Escribir los casos de prueba",
    at(2),
    "pending",
    null,
  );
  await insertRoomTask.run(
    roomId,
    null,
    lucia._id,
    "Repartir el proyecto final",
    null,
    "completed",
    at(-2, 19),
  );

  const insertMessage = sql(
    "INSERT INTO Mensajes_Salas (sala_id, usuario_id, mensaje, fecha_envio) VALUES (?, ?, ?, ?)",
  );
  await insertMessage.run(
    roomId,
    lucia._id,
    "He subido el enunciado de la práctica al campus.",
    at(-1, 18, 2),
  );
  await insertMessage.run(
    roomId,
    marcos._id,
    "Perfecto. Me pongo con Dijkstra esta tarde.",
    at(-1, 18, 10),
  );
  await insertMessage.run(
    roomId,
    lucia._id,
    "Yo preparo los casos de prueba para mañana.",
    at(0, 9, 15),
  );

  await sql(
    "INSERT INTO Notificaciones (usuario_id, remitente_id, tipo, datos) VALUES (?, ?, 'friend_request', ?)",
  ).run(
    lucia._id,
    sara._id,
    JSON.stringify({
      actorName: sara.name,
      actorHandle: sara.handle,
      requestId: String(requestId),
    }),
  );

  const insertSession = sql(
    `INSERT INTO Pomodoro (usuario_id, dia, fase, segundos_previstos, segundos_reales, completada, asignatura_id, fecha_inicio, fecha_fin)
     VALUES (?, ?, 'focus', 1500, 1500, true, ?, ?, ?)`,
  );
  for (let offset = -6; offset <= 0; offset += 1) {
    const focus = [2, 0, 3, 4, 1, 2, 1][offset + 6];
    for (let index = 0; index < focus; index += 1) {
      await insertSession.run(
        lucia._id,
        dayKey(at(offset, 12)),
        eda,
        at(offset, 16 + index, 0),
        at(offset, 16 + index, 25),
      );
    }
  }

  return [lucia, marcos, sara];
}

async function main() {
  if (env.isProduction) {
    logger.error(
      "El seed de desarrollo no se ejecuta con NODE_ENV=production.",
    );
    process.exit(1);
  }

  await connectDatabase();
  const removed = await clear();
  if (removed)
    logger.info(
      `Eliminadas ${removed} cuentas de demo anteriores y sus datos.`,
    );

  if (!process.argv.includes("--clear")) {
    const passwordHash = await hashPassword(PASSWORD);
    const users = await transaction(() => seed(passwordHash));
    logger.info(`Cuentas de demo creadas (contraseña: ${PASSWORD}):`);
    users.forEach((user) => logger.info(`  ${user.email}`));
  }
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error(error);
  await disconnectDatabase();
  process.exit(1);
});

// Datos para PRUEBAS DE CARGA. Solo contra una base de pruebas, nunca contra la real: el nombre de la
// base de DATABASE_URL tiene que contener "carga", "prueba", "test" o "smoke".
//   DATABASE_URL=postgres://…/study_planner_carga npm run seed:load -- --users 2000
//   DATABASE_URL=postgres://…/study_planner_carga npm run seed:load -- --clear
// Crea miles de cuentas @carga.study-planner.local (contraseña LOAD_PASSWORD o "carga12345") con
// asignaturas, tareas, notas, amigos, salas con mensajes y sesiones de Pomodoro. Lo usa
// scripts/load-test.mjs.
import { hashPassword } from "../auth/password.js";
import { env } from "../config/env.js";
import {
  connectDatabase,
  disconnectDatabase,
  insertRows,
  rawQuery,
  sql,
  transaction,
} from "../database/db.js";
import { removeRoomFiles } from "../uploads/storage.js";
import { generatePublicId } from "../utils/ids.js";
import { logger } from "../utils/logger.js";
import { normalizeText, searchableName } from "../utils/text.js";

export const LOAD_DOMAIN = "@carga.study-planner.local";
const PASSWORD = process.env.LOAD_PASSWORD ?? "carga12345";
const DAY = 24 * 60 * 60 * 1000;
const TEST_DATABASE = /carga|prueba|test|smoke/i;

const SUBJECTS = [
  ["Cálculo", "yellow"],
  ["Física", "blue"],
  ["Programación", "pink"],
  ["Estadística", "mint"],
  ["Historia", "coral"],
];
const TYPES = [
  "exam",
  "assignment",
  "project",
  "reading",
  "practice",
  "presentation",
  "other",
];
const PRIORITIES = ["low", "medium", "high"];
const FIRST = [
  "Ana",
  "Luis",
  "Marta",
  "Pablo",
  "Lucía",
  "Jorge",
  "Elena",
  "Sergio",
  "Carmen",
  "Diego",
];
const LAST = [
  "García",
  "López",
  "Martín",
  "Sánchez",
  "Pérez",
  "Gómez",
  "Ruiz",
  "Díaz",
  "Moreno",
  "Álvarez",
];

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(process.argv[index + 1]);
};

// Pseudoaleatorio con semilla: cada ejecución genera los mismos datos y las pruebas son comparables.
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

async function clear() {
  const users = (
    await sql("SELECT usuario_id FROM Usuarios WHERE email LIKE ?").all(
      `%${LOAD_DOMAIN}`,
    )
  ).map((row) => row.usuario_id);
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
  return { users: users.length, rooms };
}

async function seed(count, passwordHash) {
  const rand = random(42);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const now = Date.now();
  const at = (days, hour = 23, minute = 59) => {
    const date = new Date(now + days * DAY);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  const users = Array.from({ length: count }, (_, index) => {
    const name = `${FIRST[index % FIRST.length]} ${LAST[Math.floor(index / FIRST.length) % LAST.length]} Carga ${index}`;
    return { id: generatePublicId(), name, index };
  });
  await insertRows(
    "Usuarios",
    [
      "usuario_id",
      "nombre",
      "nombre_busqueda",
      "email",
      "password",
      "identificador",
      "estudios",
      "curso",
      "visibilidad_perfil",
      "buscable",
      "mostrar_notas",
    ],
    users.map((user) => [
      user.id,
      user.name,
      searchableName(user.name),
      `u${user.index}${LOAD_DOMAIN}`,
      passwordHash,
      `carga.u${user.index}`,
      "Grado de prueba de carga",
      "2º",
      "friends",
      true,
      true,
    ]),
  );
  await insertRows(
    "Ajustes_Pomodoro",
    ["usuario_id"],
    users.map((user) => [user.id]),
  );

  const subjects = await insertRows(
    "Asignaturas",
    ["usuario_id", "nombre_asignatura", "nombre_normalizado", "color"],
    users.flatMap((user) =>
      SUBJECTS.map(([name, color]) => [
        user.id,
        name,
        normalizeText(name),
        color,
      ]),
    ),
    { returning: "RETURNING asignatura_id, usuario_id" },
  );
  const subjectsOf = new Map();
  for (const row of subjects)
    subjectsOf.set(row.usuario_id, [
      ...(subjectsOf.get(row.usuario_id) ?? []),
      row.asignatura_id,
    ]);

  // 40 tareas por persona: de hace 80 días a dentro de 40, la mayoría de las pasadas completadas.
  const tasks = [];
  const grades = new Map();
  for (const user of users) {
    for (let task = 0; task < 40; task += 1) {
      const offset = Math.round(rand() * 120) - 80;
      const done = offset < -3 ? rand() < 0.85 : rand() < 0.1;
      const due = at(
        offset,
        rand() < 0.5 ? 23 : 9 + Math.floor(rand() * 10),
        rand() < 0.5 ? 59 : 0,
      );
      const title = `Tarea ${task + 1} de carga`;
      tasks.push([
        user.id,
        pick(subjectsOf.get(user.id)),
        title,
        pick(TYPES),
        pick(PRIORITIES),
        done ? "completed" : rand() < 0.2 ? "in_progress" : "pending",
        due,
        done ? due : null,
        offset < 1 ? at(-1) : null,
      ]);
      if (done && rand() < 0.7)
        grades.set(`${user.id}|${title}`, [Math.round(rand() * 100) / 10, due]);
    }
  }
  const insertedTasks = await insertRows(
    "Tareas",
    [
      "usuario_id",
      "asignatura_id",
      "titulo",
      "tipo_actividad",
      "urgencia",
      "estado",
      "fecha_entrega",
      "fecha_completada",
      "recordatorio_enviado",
    ],
    tasks,
    { returning: "RETURNING tarea_id, usuario_id, titulo" },
  );
  await insertRows(
    "Calificaciones",
    ["tarea_id", "calificacion", "fecha_registro"],
    insertedTasks
      .filter((row) => grades.has(`${row.usuario_id}|${row.titulo}`))
      .map((row) => [
        row.tarea_id,
        ...grades.get(`${row.usuario_id}|${row.titulo}`),
      ]),
  );

  const sessions = [];
  for (const user of users) {
    for (let day = -6; day <= 0; day += 1) {
      for (let block = 0; block < Math.floor(rand() * 4); block += 1) {
        const start = at(day, 16 + block, 0);
        sessions.push([
          user.id,
          start.slice(0, 10),
          "focus",
          1500,
          1500,
          true,
          subjectsOf.get(user.id)[0],
          start,
          at(day, 16 + block, 25),
        ]);
      }
    }
  }
  await insertRows(
    "Pomodoro",
    [
      "usuario_id",
      "dia",
      "fase",
      "segundos_previstos",
      "segundos_reales",
      "completada",
      "asignatura_id",
      "fecha_inicio",
      "fecha_fin",
    ],
    sessions,
  );

  // Cada persona es amiga de las 5 siguientes (anillo): 5 a 10 amigos por cabeza.
  const friendships = [];
  for (let index = 0; index < count; index += 1) {
    for (let step = 1; step <= 5 && step < count; step += 1) {
      friendships.push([
        users[index].id,
        users[(index + step) % count].id,
        "accepted",
        at(-30),
      ]);
    }
  }
  await insertRows(
    "Amigos",
    ["usuario_id", "amigo_id", "estado", "fecha_amistad"],
    friendships,
  );

  // Salas de 10 personas consecutivas con 200 mensajes y 10 tareas cada una.
  const rooms = [];
  const members = [];
  const roomTasks = [];
  const messages = [];
  for (let first = 0; first + 10 <= count; first += 10) {
    const roomId = generatePublicId();
    const people = users.slice(first, first + 10).map((user) => user.id);
    rooms.push([
      roomId,
      `Sala de carga ${rooms.length + 1}`,
      "Sala de prueba de carga",
      at(Math.floor(rand() * 14), 17, 0),
      people[0],
    ]);
    people.forEach((person, index) =>
      members.push([roomId, person, index === 0 ? "admin" : "member"]),
    );
    for (let task = 0; task < 10; task += 1)
      roomTasks.push([
        roomId,
        pick(people),
        people[0],
        `Parte ${task + 1}`,
        at(task, 20, 0),
      ]);
    for (let message = 0; message < 200; message += 1) {
      messages.push([
        roomId,
        pick(people),
        `Mensaje ${message + 1} de la prueba de carga`,
        at(-10 + message / 20, 10, 0),
      ]);
    }
  }
  await insertRows(
    "Salas",
    ["sala_id", "nombre", "descripcion", "fecha_sesion", "creador_id"],
    rooms,
  );
  await insertRows(
    "Participantes_Salas",
    ["sala_id", "usuario_id", "rol"],
    members,
  );
  await insertRows(
    "Tareas_Sala",
    ["sala_id", "usuario_id", "creador_id", "titulo", "fecha_entrega"],
    roomTasks,
  );
  await insertRows(
    "Mensajes_Salas",
    ["sala_id", "usuario_id", "mensaje", "fecha_envio"],
    messages,
  );

  return { users: count, rooms: rooms.length };
}

async function main() {
  if (env.isProduction) {
    logger.error("Los datos de carga no se generan con NODE_ENV=production.");
    process.exit(1);
  }
  const databaseName = new URL(env.databaseUrl).pathname.slice(1);
  if (!TEST_DATABASE.test(databaseName)) {
    logger.error(
      `"${databaseName}" no parece una base de pruebas: usa una cuyo nombre contenga "carga", "prueba", "test" o "smoke".`,
    );
    process.exit(1);
  }

  await connectDatabase();
  const removed = await clear();
  await Promise.all(removed.rooms.map((room) => removeRoomFiles(room.sala_id)));
  if (removed.users)
    logger.info(`Eliminadas ${removed.users} cuentas de carga anteriores.`);

  if (!process.argv.includes("--clear")) {
    const count = option("users", 2000);
    const passwordHash = await hashPassword(PASSWORD);
    const started = Date.now();
    const result = await transaction(() => seed(count, passwordHash));
    await rawQuery("ANALYZE");
    logger.info(
      `Creadas ${result.users} cuentas (u0…u${result.users - 1}${LOAD_DOMAIN}, contraseña ${PASSWORD}) y ` +
        `${result.rooms} salas en ${databaseName} (${((Date.now() - started) / 1000).toFixed(1)} s).`,
    );
  }
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error(error);
  await disconnectDatabase();
  process.exit(1);
});

// Pasa una base de datos SQLite de la versión anterior (fases 1 a 3) a PostgreSQL, con los mismos
// identificadores: los enlaces, las sesiones abiertas y los archivos subidos siguen valiendo.
//   npm run db:import-sqlite                        importa server/data/study-planner.db
//   npm run db:import-sqlite -- ruta/a/otra.db
// Solo importa en una base de PostgreSQL vacía (sin usuarios). La base SQLite no se modifica.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  connectDatabase,
  disconnectDatabase,
  insertRows,
  rawQuery,
  sql,
  transaction,
} from "./db.js";

const DEFAULT_FILE = fileURLToPath(
  new URL("../../data/study-planner.db", import.meta.url),
);

// En orden de dependencias. Los contadores de las salas no se copian: los recalculan los triggers
// al insertar mensajes, archivos y tareas.
const TABLES = [
  { name: "Usuarios" },
  { name: "Ajustes_Pomodoro" },
  { name: "Asignaturas", identity: "asignatura_id" },
  { name: "Tareas", identity: "tarea_id" },
  { name: "Calificaciones", identity: "calificacion_id" },
  { name: "Amigos", identity: "amistad_id" },
  { name: "Salas", skip: ["mensajes", "archivos", "tareas_abiertas"] },
  { name: "Participantes_Salas" },
  { name: "Invitaciones_Salas" },
  { name: "Tareas_Sala", identity: "tarea_sala_id" },
  { name: "Mensajes_Salas", identity: "mensaje_id" },
  { name: "Archivos_Salas", identity: "archivo_id" },
  { name: "Notificaciones", identity: "notificacion_id" },
  { name: "Pomodoro", identity: "pomodoro_id" },
];

async function main() {
  const file = path.resolve(process.argv[2] ?? DEFAULT_FILE);
  if (!fs.existsSync(file)) {
    logger.error(`No existe ${file}`);
    process.exit(1);
  }

  // better-sqlite3 solo hace falta aquí (dependencia de desarrollo).
  const { default: Database } = await import("better-sqlite3");
  const source = new Database(file, { readonly: true, fileMustExist: true });

  await connectDatabase();
  const { count } = await sql("SELECT COUNT(*) AS count FROM Usuarios").get();
  if (count > 0) {
    logger.error(
      "La base de PostgreSQL ya tiene usuarios: el importador solo trabaja sobre una base vacía.",
    );
    process.exit(1);
  }

  const summary = [];
  await transaction(async () => {
    for (const table of TABLES) {
      const target = table.name.toLowerCase();
      const columns = await sql(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position`,
      ).all(target);
      const sourceColumns = new Set(
        source
          .prepare(`PRAGMA table_info(${table.name})`)
          .all()
          .map((column) => column.name),
      );
      const copied = columns.filter(
        (column) =>
          sourceColumns.has(column.column_name) &&
          !table.skip?.includes(column.column_name),
      );
      const booleans = new Set(
        copied
          .filter((column) => column.data_type === "boolean")
          .map((column) => column.column_name),
      );

      const rows = source
        .prepare(
          `SELECT ${copied.map((column) => column.column_name).join(", ")} FROM ${table.name}`,
        )
        .all()
        .map((row) =>
          copied.map(({ column_name: name }) =>
            booleans.has(name) ? row[name] === 1 : row[name],
          ),
        );

      if (rows.length) {
        await insertRows(
          table.name,
          copied.map((column) => column.column_name),
          rows,
          { overriding: Boolean(table.identity) },
        );
      }
      // Los ids nuevos siguen a partir del mayor importado.
      if (table.identity) {
        await rawQuery(
          `SELECT setval(pg_get_serial_sequence('${target}', '${table.identity}'),
                         COALESCE((SELECT MAX(${table.identity}) FROM ${target}), 1),
                         (SELECT MAX(${table.identity}) IS NOT NULL FROM ${target}))`,
        );
      }
      summary.push(`${table.name}: ${rows.length}`);
    }
  });

  source.close();
  await rawQuery("ANALYZE");
  logger.info(
    `Importado ${file} en PostgreSQL (${new URL(env.databaseUrl).pathname.slice(1)}):`,
  );
  summary.forEach((line) => logger.info(`  ${line}`));
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error("No se ha podido importar:", error.message);
  await disconnectDatabase();
  process.exit(1);
});

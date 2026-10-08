import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { MIGRATIONS } from "./migrations.js";

const SCHEMA = fs.readFileSync(
  new URL("./schema.sql", import.meta.url),
  "utf8",
);

// Tipos que PostgreSQL devuelve como texto y la API usa como números o como fechas ISO:
pg.types.setTypeParser(pg.types.builtins.INT8, Number); // COUNT(*), SUM(…): siempre caben en un Number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number); // notas y medias
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) =>
  new Date(value).toISOString(),
);

let pool = null;
const transactions = new AsyncLocalStorage();
const compiled = new Map();
let statementCount = 0;
let analyzeTimer = null;
const ANALYZE_EVERY_MS = 6 * 60 * 60 * 1000;
const SCHEMA_LOCK = 7_265_309; // pg_advisory_xact_lock: un solo proceso aplica el esquema a la vez

export function db() {
  if (!pool)
    throw new Error(
      "La base de datos no está abierta. Llama antes a connectDatabase().",
    );
  return pool;
}

export async function connectDatabase({ applyMigrations = true } = {}) {
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString: env.databaseUrl,
    max: env.databasePoolSize,
    // Las conexiones se abren al arrancar y no se cierran por inactividad: abrir una (autenticación
    // SCRAM) gasta un hilo del pool de libuv, el mismo que bcrypt, y en un pico de inicios de sesión
    // las conexiones nuevas llegaban a esperar más de 10 s.
    min: env.databasePoolSize,
    idleTimeoutMillis: 0,
    // Una consulta que tarde más que esto es un fallo, no una espera: se corta.
    statement_timeout: 15_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (error) =>
    logger.error("Error en una conexión inactiva de PostgreSQL", error.message),
  );

  if (applyMigrations) await applySchema();
  const clients = await Promise.all(
    Array.from({ length: env.databasePoolSize }, () => pool.connect()),
  );
  clients.forEach((client) => client.release());

  // Estadísticas para que PostgreSQL elija bien los índices (además de las del autovacuum).
  analyzeTimer = setInterval(
    () => pool?.query("ANALYZE").catch(() => {}),
    ANALYZE_EVERY_MS,
  );
  analyzeTimer.unref();

  const { rows } = await pool.query("SELECT current_database() AS name");
  logger.info(`PostgreSQL conectado (${rows[0].name})`);
  return pool;
}

// Base nueva: schema.sql completo. Base existente: migraciones pendientes y después schema.sql, que
// solo crea lo que falte. Todo en una transacción con un bloqueo de PostgreSQL: si varias máquinas
// o procesos arrancan a la vez, esperan y el resto encuentra la base ya preparada.
async function applySchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS Version_Esquema (version integer NOT NULL)",
    );
    const { exists } = (
      await client.query("SELECT to_regclass('usuarios') IS NOT NULL AS exists")
    ).rows[0];
    const current = (await client.query("SELECT version FROM Version_Esquema"))
      .rows[0]?.version;

    if (!exists) {
      await client.query(SCHEMA);
      await setSchemaVersion(client, MIGRATIONS.length);
    } else {
      for (let next = current ?? 0; next < MIGRATIONS.length; next += 1) {
        await MIGRATIONS[next](client);
        await setSchemaVersion(client, next + 1);
        logger.info(`Base de datos migrada a la versión ${next + 1}`);
      }
      await client.query(SCHEMA);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function setSchemaVersion(client, version) {
  await client.query("DELETE FROM Version_Esquema");
  await client.query("INSERT INTO Version_Esquema (version) VALUES ($1)", [
    version,
  ]);
}

export async function disconnectDatabase() {
  clearInterval(analyzeTimer);
  compiled.clear();
  const closing = pool;
  pool = null;
  await closing?.end();
}

// Ejecuta fn dentro de una transacción: o se aplican todas sus escrituras o ninguna. Toda consulta
// hecha con sql() dentro de fn (también en funciones a las que llame) usa la misma conexión.
// Una transacción dentro de otra se une a la de fuera.
// PostgreSQL ejecuta transacciones en paralelo: las comprobaciones de "contar y después insertar"
// bloquean antes la fila que las ordena (lockRow, SELECT … FOR UPDATE).
export async function transaction(fn) {
  if (transactions.getStore()) return fn();

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await transactions.run({ client }, fn);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Bloquea una fila hasta el final de la transacción: otras transacciones que quieran bloquearla
// esperan. Serializa las operaciones sobre una misma sala o un mismo usuario.
const LOCKS = {
  sala: "SELECT 1 FROM Salas WHERE sala_id = ? FOR UPDATE",
  usuario: "SELECT 1 FROM Usuarios WHERE usuario_id = ? FOR UPDATE",
};
export function lockRow(kind, id) {
  return sql(LOCKS[kind]).get(id);
}

// Las consultas se escriben con parámetros `?` (por posición) o `@nombre` (con un objeto) y aquí se
// traducen a $1, $2… Cada texto se prepara una vez por conexión (sentencia con nombre).
function compile(text) {
  let entry = compiled.get(text);
  if (entry) return entry;

  const names = [];
  let positional = 0;
  const converted = text.replace(/@([a-zA-Z_]\w*)|\?/g, (_match, name) => {
    if (!name) {
      positional += 1;
      return `$${positional}`;
    }
    let index = names.indexOf(name);
    if (index === -1) index = names.push(name) - 1;
    return `$${index + 1}`;
  });
  statementCount += 1;
  entry = { text: converted, names, name: `sp_${statementCount}` };
  compiled.set(text, entry);
  return entry;
}

const toValue = (value) => (value === undefined ? null : value);

async function execute(text, args) {
  const entry = compile(text);
  const values = entry.names.length
    ? entry.names.map((name) => toValue(args[0]?.[name]))
    : args.map(toValue);
  const client = transactions.getStore()?.client ?? db();

  const start = performance.now();
  const result = await client.query({
    name: entry.name,
    text: entry.text,
    values,
  });
  const elapsed = performance.now() - start;
  if (env.slowQueryMs && elapsed >= env.slowQueryMs) {
    logger.warn(
      `Consulta lenta (${elapsed.toFixed(1)} ms): ${text.replace(/\s+/g, " ").trim().slice(0, 240)}`,
    );
  }
  return result;
}

// API parecida a la de better-sqlite3, pero asíncrona:
//   await sql(text).get(…)  primera fila o undefined
//   await sql(text).all(…)  todas las filas
//   await sql(text).run(…)  { changes, lastInsertRowid } (para lastInsertRowid, termina con RETURNING <id>)
export function sql(text) {
  return {
    get: async (...args) => (await execute(text, args)).rows[0],
    all: async (...args) => (await execute(text, args)).rows,
    run: async (...args) => {
      const result = await execute(text, args);
      const first = result.rows[0];
      return {
        changes: result.rowCount,
        lastInsertRowid: first ? Object.values(first)[0] : undefined,
      };
    },
  };
}

// Consulta sin preparar, para SQL generado (inserciones masivas de los scripts).
export function rawQuery(text, values = []) {
  const client = transactions.getStore()?.client ?? db();
  return client.query(text, values);
}

// INSERT de muchas filas por sentencia, para los scripts (PostgreSQL admite 65.535 parámetros).
// `overriding` permite dar valor a las columnas identity (importar con los ids originales).
export async function insertRows(
  table,
  columns,
  rows,
  { returning = "", overriding = false } = {},
) {
  const result = [];
  const perStatement = Math.max(1, Math.floor(60_000 / columns.length));
  for (let start = 0; start < rows.length; start += perStatement) {
    const values = [];
    const tuples = rows
      .slice(start, start + perStatement)
      .map(
        (row) =>
          `(${row.map((value) => `$${values.push(value === undefined ? null : value)}`).join(", ")})`,
      );
    const { rows: inserted } = await rawQuery(
      `INSERT INTO ${table} (${columns.join(", ")}) ${overriding ? "OVERRIDING SYSTEM VALUE " : ""}VALUES ${tuples.join(", ")} ${returning}`,
      values,
    );
    result.push(...inserted);
  }
  return result;
}

// Fechas: ISO 8601 en UTC (PostgreSQL las guarda como timestamptz).
export const iso = (value) =>
  value == null ? null : new Date(value).toISOString();
export const nowIso = () => new Date().toISOString();

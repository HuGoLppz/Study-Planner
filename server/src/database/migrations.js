// Cambios sobre bases creadas con una versión anterior del esquema. schema.sql describe siempre el
// esquema completo y actual (una base nueva se crea directamente con él y queda en la última
// versión); cada migración lleva una base existente de la versión N a la N + 1, se aplica una sola
// vez (tabla Version_Esquema) y recibe la conexión de la transacción: `await client.query(…)`.
// Solo para lo que CREATE … IF NOT EXISTS no puede hacer: columnas nuevas, datos que rellenar…
// Los triggers e índices nuevos van en schema.sql, que se ejecuta después de migrar.
//
// La versión 0 es el esquema de PostgreSQL de la fase 4. Las bases SQLite anteriores se pasan
// con `npm run db:import-sqlite` (database/import-sqlite.js).
export const MIGRATIONS = [];

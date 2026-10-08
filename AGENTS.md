# AGENTS.md

Guía para agentes de código que trabajen en este repositorio. Complementa a
[README.md](README.md) (instalación y despliegue) y a [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(modelo de datos, índices, API y sistema visual). Si cambias algo que esos documentos describen,
actualízalos en el mismo cambio.

## El proyecto

Study Planner: organización académica y colaboración entre estudiantes. Monorepo con dos paquetes
independientes y sin workspaces:

- `server/`: API REST + Socket.IO. Node ≥ 20.19, ESM, Express 5, pg 8, zod 3. Redis y S3 opcionales.
- `client/`: SPA. React 19, Vite 7, React Router 7, TanStack Query 5, Zustand, CSS global.
- Base de datos: **PostgreSQL 17**, relacional (`DATABASE_URL`). En desarrollo corre en Docker
  (`npm run services:up`, ver `docker-compose.yml`). El esquema está en `server/src/database/schema.sql`.
  No añadas un ORM ni otra base de datos. Redis (`REDIS_URL`) y S3 (`S3_BUCKET`) solo hacen falta con
  varias máquinas.

Todo el texto de la interfaz, los mensajes de error de la API, los comentarios y la documentación
están **en español de España**.

## Comandos

Desde la raíz:

| Comando | Qué hace |
|---------|----------|
| `npm run install:all` | Instala dependencias de `server/` y `client/` |
| `npm run dev` | API (puerto 4000, `node --watch`) y web (5173) a la vez |
| `npm run dev:server` / `npm run dev:client` | Cada uno por separado |
| `npm run build` | Compila el cliente en `client/dist` |
| `npm start` | API en modo producción |
| `npm run seed` / `npm run seed:clear` | Crea o borra las cuentas de demostración |
| `npm run services:up` / `npm run services:down` | Arranca o para PostgreSQL, Redis y S3 de desarrollo (Docker) |
| `npm run db:import-sqlite` | Pasa una base SQLite antigua a una base PostgreSQL vacía |

No hay suite de tests ni linter configurados. La verificación mínima de cualquier cambio es:

1. `npm run build` sin errores (compila todo el cliente).
2. Arrancar la API y ejercitar los endpoints afectados (ver "Probar sin ensuciar datos").
   Si el cambio afecta a consultas o a endpoints frecuentes, pasa también la prueba de carga
   (`npm run seed:load` + `npm run load-test`, ver README) y compara con la tabla de referencia.
3. Para cambios visuales, revisar la página en escritorio (≥ 1100 px), tablet (768–1099 px) y móvil (< 768 px).

## Configuración

- `server/.env` es obligatorio (copia `server/.env.example`). Con un `JWT_SECRET` de menos de 32 caracteres
  el servidor no arranca: `config/env.js` valida al iniciar. `DATABASE_URL` también es obligatoria.
- Nunca escribas secretos en el código ni los subas al repositorio. `.env*` está en `.gitignore`
  salvo los `.env.example`.
- En desarrollo el cliente no necesita `.env`: Vite reenvía `/api` y `/socket.io` a
  `VITE_DEV_API_TARGET` (por defecto `http://localhost:4000`).

## Probar sin ensuciar datos

La aplicación **no debe mostrar nunca datos inventados**: la base real (`study_planner`) solo contiene
lo que crean los usuarios. Para probar:

```bash
docker compose exec postgres createdb -U study_planner study_planner_smoke
cd server
export DATABASE_URL=postgres://study_planner:study_planner_dev@localhost:5432/study_planner_smoke
PORT=4100 UPLOAD_DIR=uploads-smoke npm run dev
npm run seed
```

```bash
cd client
VITE_DEV_API_TARGET=http://localhost:4100 npm run dev
```

Al terminar, para el servidor de pruebas, borra la base (`docker compose exec postgres dropdb -U
study_planner study_planner_smoke`) y `uploads-smoke/`; si has probado con Redis o S3, vacía Redis y
borra el bucket de pruebas. No toques la base `study_planner` ni `uploads/`: son los datos reales.
`npm run seed:load` solo acepta bases cuyo nombre contenga `carga`, `prueba`, `test` o `smoke`. Las
peticiones que modifican datos deben llevar un `Origin` permitido (`http://localhost:5173`); si llamas a
la API con `fetch`/`curl`, añádelo.

El seed (`server/src/seed/dev-seed.js`) es solo para desarrollo: se niega a correr con
`NODE_ENV=production`, sus cuentas usan el dominio `@demo.study-planner.local` y `seed:clear` borra
únicamente lo que lleva ese dominio. No añadas datos de ejemplo en ningún otro sitio.

## Servidor (`server/src`)

### Capas: respeta el sentido de las dependencias

`routes → middleware → controllers → services → models`

- **routes/**: solo declaran método, ruta, middleware y controlador. Un router por recurso, montado
  en `routes/index.js`. Todo lo montado después de `apiRouter.use(requireAuth)` exige sesión.
- **validators/**: un esquema zod por endpoint creado con `request({ body, query, params })` de
  `validators/common.js`. Los mensajes de zod ya salen en español por el `errorMap` global.
- **middleware/validate.js** deja los datos validados en `req.valid`. **Los controladores leen solo
  de `req.valid`**, nunca de `req.body`/`req.query` directamente (así nunca llegan campos no validados).
- **controllers/**: traducen HTTP ↔ servicio. Sin lógica de negocio ni consultas.
- **services/**: toda la lógica y el único sitio que escribe SQL (con `sql()`, `transaction()` y
  `lockRow()` de `database/db.js`). Los controladores y el middleware llaman a funciones de servicio.
  Todo acceso a la base es asíncrono: `await sql(…).get/all/run(…)`.
- **models/**: no son clases. Cada archivo exporta los `SELECT` reutilizables y la función que convierte
  una fila (columnas en español) en el objeto de la API (`toTask`, `toRoomTask`, `toNotification`…).
  `loadUser()` devuelve el usuario completo con sus asignaturas y ajustes; es lo que queda en `req.user`.
- **serializers/**: qué se expone de un usuario. Para incluir a una persona dentro de otra respuesta,
  une `Usuarios` con `summaryColumns(alias, prefijo)` y conviértela con `summaryFrom(fila, prefijo)`
  (`models/user.model.js`). Nunca devuelvas `password`, `version_sesion` ni `nombre_busqueda`.

### Convenciones

- Express 5 propaga solos los errores de funciones `async`: no envuelvas handlers en `try/catch`
  ni uses `asyncHandler`.
- Errores de dominio con `ApiError` (`utils/ApiError.js`): `badRequest`, `unauthorized`,
  `forbidden`, `notFound`, `conflict`, `unprocessable(message, fields)`. La respuesta siempre tiene
  la forma `{ error: { message, code, fields? } }`; el cliente asigna `fields` a los campos del formulario.
- Códigos HTTP: 201 al crear, 204 sin cuerpo al borrar, 409 para conflictos de estado, 422 para
  validación, 404 cuando el recurso no existe **o no es del usuario** (no reveles su existencia).
- Las respuestas usan `_id` (no `id`) y **todos los ids van como texto**: el cliente los compara con
  `===` contra parámetros de la URL. Convierte siempre con `String()` en los `to…()` de `models/`.
- Valores de dominio y límites (tipos de tarea, colores, máximos por sala…) viven en
  `config/constants.js`. No los repitas en modelos, validadores ni servicios.
- Ids en validadores: `publicId` para usuarios y salas (9 caracteres, `utils/ids.js`) y `numericId`
  para el resto (`validators/common.js`). `idParams('roomId', 'taskId')` elige el tipo por el nombre.
- Fechas: columnas `timestamptz`; la base las devuelve ya como texto ISO 8601 UTC. Escribe con `iso()`
  para que la API y la base usen el mismo formato.
- Booleanos de verdad (`leida`, `buscable`…): `NOT leida`, nunca `= 0`. Los datos de los avisos son
  `jsonb` (`datos->>'requestId'`).
- Los alias que la API lee en camelCase van entre comillas (`COUNT(*) AS "openTasks"`): PostgreSQL pasa
  a minúsculas los que no las llevan.
- Consultas siempre con parámetros (`?` o `@nombre`, que `sql()` traduce a `$n`), nunca concatenando
  valores del usuario. Para listas de ids usa `= ANY(@ids::text[])` (o `::int[]`) con el array tal cual.
- Para comparar u ordenar ids públicos como lo hace JavaScript usa `COLLATE "C"` (lo necesita
  `PAIR_WHERE`).
- Búsquedas de texto sin tildes ni mayúsculas: la función SQL `normalizar()` (definida en
  `schema.sql` con `unaccent`; la de personas usa además índices de trigramas) y `normalizeText()` sobre el término, con `LIKE … ESCAPE '\'` y `escapeLike()`.

### Modelo relacional

El esquema está en `server/src/database/schema.sql` y se aplica en cada arranque (es idempotente).
Antes de añadir una tabla, revisa la sección 4 de `docs/ARCHITECTURE.md`. Reglas que el código asume:

- Tablas y columnas en español y `snake_case` (`Tareas.fecha_entrega`); los valores cerrados
  (`estado`, `tipo_actividad`, `color`…) se guardan con los códigos de `config/constants.js`
  (`'completed'`, `'exam'`…), que son los que viajan por la API. Si cambias una constante, cambia el
  `CHECK` correspondiente en `schema.sql`.
- Cada asignatura pertenece a un usuario (`Asignaturas.usuario_id`) y la tarea guarda `asignatura_id`.
  Comprueba que es del usuario con `assertOwnSubject` (el trigger `tr_tareas_asignatura_propia`
  también lo impide; los errores de trigger llegan como SQLSTATE `P0001` y la API responde 409). Al borrar una asignatura, `ON DELETE SET NULL` deja sus tareas sin asignatura.
- La nota está en `Calificaciones` (1:1 con la tarea) y solo existe si la tarea está completada; los
  triggers impiden calificar una pendiente y borran la nota al reabrirla.
- "Atrasada" se calcula (`OVERDUE_SQL` en `task.service.js`); no se guarda.
- Contadores de sala (`Salas.mensajes`, `archivos`, `tareas_abiertas`): los mantienen los triggers
  `tr_contador_*`. Léelos de la sala y no los escribas desde el código. Un contador nuevo, igual:
  columna más triggers de alta, baja y cambio, nunca `COUNT` sobre tablas que crecen sin límite.
- Amistades: una fila por pareja en `Amigos`; búscala con `PAIR_WHERE` (`friend.service.js`), que usa
  el índice único `ux_amigos_pareja`.
- Una operación que lee y escribe varias filas, o que comprueba un límite antes de insertar, va dentro
  de `await transaction(async () => …)`. Las llamadas a `sql()` dentro usan la misma conexión sin
  pasarla (AsyncLocalStorage); una transacción dentro de otra se une a la exterior. Las transacciones
  corren en paralelo: si compruebas una regla y luego escribes (máximo de participantes, último
  administrador, límites), empieza con `await lockRow('sala', roomId)` o `lockRow('usuario', userId)`.
  Emite eventos, crea avisos (`notify`) e invalida cachés después de la transacción, no dentro.
- Cambios de esquema: `schema.sql` es siempre el esquema completo y actual (tablas nuevas, índices y
  triggers van ahí con `IF NOT EXISTS` o `CREATE OR REPLACE`). Si cambias una tabla que ya existe (columna nueva, datos que
  rellenar), refleja el cambio en `schema.sql` **y** añade una migración al final de
  `database/migrations.js`; nunca edites una migración ya publicada. Ver sección 4.4 de `ARCHITECTURE.md`.
- Si una consulta nueva va a ser frecuente, añade su índice y documéntalo en la tabla de índices de
  `ARCHITECTURE.md`. Comprueba que se usa con `EXPLAIN` (con datos de `seed:load`: con pocas filas
  PostgreSQL prefiere recorrer la tabla).
- Búsqueda de personas: índices GIN de trigramas (`pg_trgm`) sobre `' ' || nombre_busqueda` y sobre
  `identificador`; `searchUsers` filtra con `LIKE` sobre esas mismas expresiones para que los use.

### Rendimiento

Cada proceso es un único hilo: cualquier trabajo de CPU caro en una petición frena a todos sus
usuarios. Y cada consulta es un viaje de red a PostgreSQL: lanza en paralelo (`Promise.all`) las que
no dependen unas de otras y no hagas consultas dentro de bucles. Ver la sección 9 de `ARCHITECTURE.md`.

- Las consultas que pasan de `SLOW_QUERY_MS` salen en el registro: revísalo tras cambiar una consulta.
- Nada de trabajo caro por fila: objetos como `Intl.DateTimeFormat`, expresiones regulares complejas
  o claves criptográficas se crean una vez y se reutilizan (`formatterFor` en `grade.service.js`).
- Lo que consume CPU de verdad (hash de contraseñas, imágenes) va al pool de hilos de libuv con
  librerías nativas (`bcrypt`, `sharp`), nunca con implementaciones en JavaScript puro.
- Los límites de peticiones son por usuario (`userLimiter`, tras `requireAuth`); por IP solo lo que no
  tiene sesión. No limites rutas con sesión por IP: en una universidad cientos de personas comparten IP.
- `loadUser()` trae el usuario y sus asignaturas en una sola consulta (`json_agg`): no añadas
  consultas por petición en `requireAuth`.
- Las estadísticas académicas se cachean 30 s por usuario (`services/academicCache.js`). Toda escritura
  que cambie tareas, notas o asignaturas de un usuario llama a `invalidateAcademic(userId)`; si añades
  una, haz lo mismo o el dashboard y las notas mostrarán datos viejos. Invalida después de confirmar
  la transacción: si invalidas dentro, otra petición puede volver a cachear los datos anteriores.
- Listas que se muestran recortadas (el dashboard enseña 4 salas y 8 amigos): pide solo esas filas con
  `LIMIT` y los totales con `COUNT`, nunca la lista entera para recortarla en JavaScript.

### Varios procesos y varias máquinas

Con `WORKERS` > 1 hay varios procesos de la API a la vez, y con `REDIS_URL` puede haber varias
máquinas con la misma base (ver la sección 9 de `ARCHITECTURE.md`).
El código tiene que funcionar igual con uno que con varios:

- Nada de estado en memoria que deba ser común a todos los procesos. Una caché local se puede, pero
  su invalidación se publica con `publish()` de `cluster/bus.js` (como `invalidateAcademic`), que va
  por IPC en una máquina y por Redis entre varias. Nada en disco local: fotos y archivos van por
  `uploads/objectStore.js`.
- Lo que debe ocurrir una sola vez (jobs, limpiezas) corre solo si `isLeader` (`cluster/role.js`) y,
  si toca datos, reclama las filas de forma atómica (`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP
  LOCKED) RETURNING`): con varias máquinas hay un líder en cada una.
- Los limitadores se crean con `limiter('prefijo', …)` (`middleware/security.js`): el prefijo es
  único por limitador y el almacén ya es compartido (memoria del principal o Redis).
- Socket.IO solo por WebSocket, en el servidor y en el cliente: no añadas *long-polling*.
- Cada proceso abre `DATABASE_POOL_SIZE` conexiones: procesos × máquinas × tamaño tiene que caber en
  el `max_connections` de PostgreSQL.
- Pruébalo también en cluster: arranca la API de pruebas con `WORKERS=4` y, si tocas algo compartido,
  con dos servidores en puertos distintos y el Redis y el S3 de `docker compose`.

### Tiempo real y avisos

- Las escrituras van **siempre por REST**; Socket.IO solo difunde. Emite únicamente a través de
  `sockets/emitter.js` (`emitToRoom`, `emitToUser`…).
- Tras cualquier cambio en una sala, termina con `broadcastRoom(roomId, pick)` (`room.service.js`):
  devuelve la sala completa (la respuesta para quien hizo el cambio) y emite a la sala un `room:patch`
  con solo lo que `pick` elige del detalle (`info`, `members`, `invitations`, `tasks`, `task` o
  `deletedTaskId`, más `stats` y `lastActivityAt`). El cliente lo aplica con `applyRoomPatch`
  (`utils/rooms.js`). Si añades un tipo de cambio, añádelo en los dos sitios.
- En el cliente, un evento que afecta a listas de otros (por ejemplo, la lista de salas) las invalida
  con `refetchType: 'none'`: se recargan al volver a ellas, no todas a la vez en cada cliente conectado.
- Los avisos se crean con `notify()` (`notification.service.js`), que nunca lanza: un aviso fallido
  no debe romper la operación que lo origina. Guarda en `data` una instantánea (nombres, títulos) para
  pintarlo sin joins.

### Archivos

- Los tipos permitidos están en `uploads/fileTypes.js` (extensión → tipo MIME → firma binaria).
  Añadir un formato es añadir una fila ahí y, en el cliente, en `ACCEPTED_FILES` (`hooks/useRoomFiles.js`).
- Los archivos se guardan con nombre aleatorio a través de `uploads/objectStore.js` (disco en
  `UPLOAD_DIR` o S3, con la misma interfaz); no uses `fs` directamente para ellos. Solo se sirven por
  rutas autenticadas que comprueban la pertenencia a la sala (`loadRoom` va **antes** de multer); con
  S3 la descarga es una redirección a un enlace firmado de 60 s.
- La foto de perfil se recibe en memoria y se guarda solo la versión optimizada por
  `uploads/images.js` (sharp: 256×256, WebP, sin metadatos). No guardes nunca el original. Su URL lleva
  `?v=<fecha>`, por eso se sirve con caché `immutable`: si cambias cómo se genera, cambia también la URL.

## Cliente (`client/src`)

### Dónde va cada cosa

| Carpeta | Contenido |
|---------|-----------|
| `services/resources/*.api.js` | Una función por endpoint; devuelven el cuerpo ya desempaquetado. Exportadas desde `services/api.js` |
| `hooks/` | Hooks de TanStack Query por recurso y hooks de interfaz (`useUi.js`). Las claves de caché están todas en `hooks/queryKeys.js` |
| `store/` | Zustand: `uiStore` (panel global de tarea, avisos), `confirmStore` (`confirm()`), `pomodoroStore` (persistido) |
| `components/ui/` | Primitivas compartidas: `Button`, `Field`/`Input`/`Select`, `Modal`/`Drawer`/`OverlayFooter`, `EmptyState`, `ErrorState`, `Skeleton`, `AppSkeleton`/`PageSkeleton`/`SkeletonBody`, `Tabs`/`Segmented`, `Menu`, `Avatar`, `SubjectTag`, `Page`/`PageHeader`/`Section` |
| `components/<dominio>/` | Componentes de tareas, calendario, salas, gráficas, perfil… |
| `pages/` | Una página por ruta, con `export default` (se cargan con `lazy`) |
| `utils/` | Lógica pura: fechas (`dates.js`), reglas de tareas, formato, calendario, textos de avisos |

### Convenciones

- Los componentes no llaman a `services/` directamente: usan un hook. La lógica que no es de pintado
  (agrupar, calcular, formatear) va en `utils/`.
- Tras crear, editar, completar o calificar una tarea llama a `invalidateAcademic(queryClient)`:
  afecta a listas, calendario, notas, dashboard y perfil.
- Los hooks de mutación muestran los toasts de éxito y error. Si el error trae `fields`, el hook no
  muestra toast y el formulario los pinta con `applyFieldErrors(setError, error)`.
- Formularios: `react-hook-form` + `zodResolver` con mensajes en español, y siempre el envoltorio
  `<Field>` (conecta etiqueta, ayuda y error con ARIA).
- Confirma las acciones destructivas con `await confirm({ title, description, confirmLabel, tone: 'danger' })`.
- Toda página empieza con `<Page title="…">` (fija el título de la pestaña) y usa `PageHeader` y `Section`.
- Nada de spinners para cargar contenido (solo dentro de botones con `loading`): la carga se ve como
  un esqueleto con la forma de lo que llega. Al comprobar la sesión se pinta la app entera
  (`AppSkeleton`), al cargar una página lazy su esqueleto (`PageSkeleton`, variante según la ruta en
  `skeletonVariantFor`) y, si la página entera espera datos, `SkeletonBody` con la misma variante. Si
  añades una página con forma propia, añade su variante en `components/ui/AppSkeleton.jsx`.
- Cada lista o vista con datos tiene tres estados: carga (`Skeleton`/`SkeletonList`/`SkeletonBody`), error
  (`ErrorState` con reintentar) y vacío (`EmptyState` con una acción). Al refiltrar, mantén los datos
  anteriores atenuados (`placeholderData: keepPreviousData` + `data-stale`) en vez de mostrar esqueletos.
- Fechas: una tarea "sin hora" vence a las 23:59 locales (`combineDateTime`, `hasTime`). Las claves
  de día (`dayKey`) y los rangos del dashboard se calculan en el cliente con su zona horaria.

## Sistema visual

Las decisiones están en la sección 8 de `docs/ARCHITECTURE.md`. Al tocar la interfaz:

- **Colores**: solo tokens de `styles/tokens.css` (`--ink`, `--sheet`, `--rule`, `--marker`,
  `--red-pen`…), nunca hex sueltos en componentes. Cada token tiene valor claro y oscuro en
  `[data-theme='dark']`; si añades uno, define ambos.
- El fluorescente (`--marker`, clase `.swipe`) marca solo lo que es *ahora*, *siguiente* o
  *seleccionado*. El rojo (`--red-pen`) solo para atrasado y destructivo.
- Los colores de asignatura se guardan como nombre (`yellow`, `pink`…) y se pintan con
  `subjectColor(color)` → `var(--hl-<color>)`, con texto `--on-marker` encima.
- **Tipografía**: Recursive. Titulares con `.page-title`, `.section-title` o `.display` (eje casual
  vía `--casl: 1`); la interfaz y las cifras de las gráficas, sin eje casual.
- **Iconos**: `@phosphor-icons/react`. Nada de emojis como iconos.
- **Textos**: español, en minúscula salvo la inicial, verbos concretos ("Guardar cambios", "Crear
  tarea"), el toast repite el verbo del botón ("Tarea creada"). Evita etiquetas en mayúsculas,
  separadores con punto medio (`·`) y flechas `→` en botones o enlaces.
- **Responsive**: puntos de corte en 767 px (móvil) y 1099 px (tablet). Nada de scroll horizontal de
  página. Los contenedores `display: grid` que listan elementos necesitan
  `grid-template-columns: minmax(0, 1fr)` y los hijos flex con texto `min-width: 0`; si no, el
  contenido desborda en móvil. El scroll horizontal solo se permite dentro de contenedores pensados
  para ello (horizonte, pestañas).
- **Hojas de estilo**: solo hay dos archivos. `styles/tokens.css` guarda los valores de diseño y
  `styles/app.css` todo lo demás. No crees más archivos CSS ni uses CSS Modules o estilos en línea
  para lo que pueda ir en `app.css` (los estilos en línea solo para valores calculados en tiempo de
  ejecución, como anchos de barras o el color de una asignatura).
- **Nombres de clase**: son globales, así que cada componente usa su prefijo en kebab-case
  (`tasks-row`, `rooms-chat-column`, `calendar-chip`…). Las utilidades sin prefijo (`.display`,
  `.page-title`, `.section-title`, `.muted`, `.small`, `.truncate`, `.swipe`, `.visually-hidden`,
  `.overdue-text`, `.tabular`) están al principio de `app.css`. Antes de crear una clase, busca que
  no exista ya.
- **Orden de `app.css`**: base y utilidades, primitivas de `components/ui`, layouts, componentes y,
  al final, páginas. Cada bloque va bajo un comentario con su nombre: añade los estilos nuevos en el
  bloque de su componente. Lo que va después gana con la misma especificidad, así que una página
  puede ajustar una primitiva sin trucos.
- Las variantes y tamaños de las primitivas se construyen como `<prefijo>-<valor>` (`button-sm`,
  `overlay-drawer`, `page-narrow`); las variantes en camelCase pasan a kebab-case (`dangerGhost` →
  `button-danger-ghost`, ver `VARIANT_CLASS` en `Button.jsx`).
- **Gráficas** (`components/charts/`): marcas finas, rejilla de línea continua, colores
  `--chart-accent`, `--chart-muted` y `--chart-alert` (ya validados para daltonismo y contraste), el
  texto nunca en el color de la serie, leyenda cuando hay dos series o más, y siempre una tabla o
  cifras visibles como alternativa al tooltip.
- **Movimiento**: solo como respuesta a una acción del usuario; respeta `prefers-reduced-motion`
  (ya cubierto en `app.css`).

## Seguridad

- Contraseñas con bcrypt (`auth/password.js`); sesión JWT en cookie `httpOnly` con `tokenVersion`
  (cambiar la contraseña invalida las demás sesiones).
- Cada consulta de datos de usuario filtra por propietario o por pertenencia a la sala (`loadRoom`).
  No confíes en ids que lleguen del cliente sin esa comprobación.
- `verifyOrigin`, CORS, Helmet y los limitadores de `middleware/security.js` se aplican a toda la
  API; no los desactives para depurar. En producción, detrás de un proxy, `TRUST_PROXY` es obligatorio
  (el servidor avisa en el registro si llegan cabeceras `X-Forwarded-For` sin él).
- Respeta siempre la privacidad del perfil (`privacy.profileVisibility`, `searchable`, `showGrades`)
  al exponer datos de otros usuarios (`user.service.js#getProfile`, `searchUsers`).

## Añadir un recurso nuevo (lista de pasos)

1. Valores y límites en `server/src/config/constants.js`.
2. Tabla, claves foráneas, `CHECK` e índices en `server/src/database/schema.sql`, y su conversión de
   fila a objeto en `server/src/models/`.
3. Esquemas en `server/src/validators/`.
4. Servicio → controlador → router; montar el router en `routes/index.js`.
5. Cliente: `services/resources/<recurso>.api.js` y exportarlo en `services/api.js`.
6. Claves en `hooks/queryKeys.js` y hooks de consulta y mutación.
7. Página lazy en `router.jsx` y, si es una sección principal, entrada en `layouts/navigation.js`.
8. Actualizar `docs/ARCHITECTURE.md` (modelo, índices, tabla de API) y el README si cambian comandos o variables.

# STUDY-PLANNER — Arquitectura y decisiones de diseño

Este documento recoge el análisis previo a la implementación: arquitectura, estructura de carpetas,
modelo relacional (PostgreSQL), índices, API, navegación, sistema visual y escalabilidad.

---

## 1. Análisis de requisitos

STUDY-PLANNER resuelve dos trabajos distintos para un estudiante universitario:

1. **Saber qué tiene que hacer y cuándo** (tareas, entregas, calendario, notas, Pomodoro). Es un uso
   individual, diario y de lectura muy frecuente: el dashboard, la lista de tareas y el calendario se
   consultan muchas más veces de las que se escriben.
2. **Trabajar con otros** (amigos, salas, tareas compartidas, chat, archivos, notificaciones). Es un
   uso colaborativo, con escrituras concurrentes (mensajes, archivos) y necesidad de tiempo real.

Consecuencias técnicas:

- El dashboard debe resolverse con **una sola petición** que agregue todo lo necesario.
- Las estadísticas (medias, evolución, progreso) se calculan con **consultas SQL** (`GROUP BY`,
  funciones de ventana), no en el cliente ni con datos precalculados que puedan quedar desfasados.
- El chat necesita **Socket.IO**; las escrituras siguen pasando por la API REST (validación y
  permisos en un único punto) y el socket solo difunde los cambios.
- Los archivos se guardan en disco (fuera de cualquier carpeta pública) y en la base de datos solo los metadatos.
- Todos los estados derivados (por ejemplo, "atrasada") se calculan a partir de datos reales; nunca se
  almacenan, para que no puedan contradecirse.

## 2. Arquitectura

```
┌──────────────────────────┐     REST /api (JSON, cookie httpOnly)    ┌──────────────────────────┐
│  client/  React + Vite   │ ───────────────────────────────────────▶ │  server/  Node + Express │
│  React Router            │                                          │  routes → controllers    │
│  TanStack Query (cache)  │ ◀─────────── Socket.IO (eventos) ─────── │  → services → models     │
│  Zustand (estado local)  │                                          │  pg (PostgreSQL)         │
└──────────────────────────┘                                          └────────────┬─────────────┘
                                                                                   │
                                                          ┌────────────────────────┴───────┐
                                                          │ PostgreSQL · Redis (opcional)  │
                                                          │ uploads/ (archivos en disco)   │
                                                          └────────────────────────────────┘
```

- **Autenticación**: JWT firmado con `JWT_SECRET`, enviado en una cookie `httpOnly`, `SameSite=Lax`
  y `Secure` en producción. El token incluye `tokenVersion`; cambiar la contraseña invalida el resto
  de sesiones. El socket se autentica con la misma cookie.
- **Capas del servidor**: las rutas solo declaran middleware y controlador; los controladores traducen
  HTTP ↔ servicio; los servicios contienen la lógica de negocio y son el único sitio que habla con los
  modelos.
- **Estado del cliente**: TanStack Query es la fuente de verdad de los datos del servidor (caché,
  reintentos, invalidación tras mutaciones). Zustand guarda solo estado de interfaz (cajón de tarea
  abierto) y el temporizador Pomodoro, que debe sobrevivir a cambios de página y recargas.

## 3. Estructura de carpetas

```
Study-Planner/
├── package.json              scripts raíz (dev conjunto, build)
├── README.md
├── docs/ARCHITECTURE.md
├── server/
│   ├── .env.example
│   ├── uploads/              archivos subidos (ignorado por git)
│   └── src/
│       ├── server.js         arranque: un proceso o cluster según WORKERS
│       ├── worker.js         un proceso de la API: BD, HTTP, Socket.IO, tareas programadas
│       ├── cluster/          proceso principal, papel de cada proceso, bus de mensajes
│       ├── app.js            Express: seguridad, parsers, rutas, errores
│       ├── config/           variables de entorno validadas y constantes de dominio
│       ├── database/         conexión a PostgreSQL, schema.sql, migraciones, importador de SQLite
│       ├── models/           columnas y conversión de fila a objeto
│       ├── auth/             contraseñas, tokens y cookies
│       ├── middleware/       auth, validación, acceso a salas, errores, límites
│       ├── validators/       esquemas zod por recurso
│       ├── routes/           un router por recurso
│       ├── controllers/      adaptadores HTTP
│       ├── services/         lógica de negocio
│       ├── serializers/      qué se expone de cada usuario
│       ├── uploads/          configuración de multer y almacenamiento
│       ├── sockets/          servidor Socket.IO y emisores
│       ├── jobs/             recordatorios de entregas
│       ├── utils/            utilidades sin dependencias de dominio
│       └── seed/             datos de desarrollo (independientes, nunca automáticos)
└── client/
    ├── .env.example
    └── src/
        ├── main.jsx, App.jsx, router.jsx
        ├── assets/           logotipo e ilustraciones SVG
        ├── styles/           tokens.css (valores de diseño) y app.css (todos los estilos)
        ├── layouts/          AppLayout (rail, barra inferior), AuthLayout
        ├── pages/            una página por ruta
        ├── components/       ui/ (primitivas) y componentes por dominio
        ├── hooks/            hooks de datos (React Query) y de interfaz
        ├── services/         cliente HTTP y funciones por recurso, socket
        ├── store/            Zustand (UI y Pomodoro)
        ├── context/          AuthProvider
        └── utils/            fechas, formato, reglas de tareas, constantes
```

## 4. Modelo relacional (PostgreSQL)

El esquema completo, con comentarios, está en
[`server/src/database/schema.sql`](../server/src/database/schema.sql). Se aplica al arrancar el
servidor y es idempotente (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE` para funciones y triggers).
Se accede con `pg` a través de `database/db.js`.

Hasta la fase 3 la base era SQLite. Se cambió a PostgreSQL para poder repartir la API entre varias
máquinas: un archivo SQLite solo puede abrirlo un servidor. Las tablas, columnas y reglas son las
mismas; `npm run db:import-sqlite` pasa una base antigua con los mismos identificadores.

### 4.1 Tablas

| Tabla                 | Clave primaria                      | Qué guarda                                                        |
|-----------------------|-------------------------------------|-------------------------------------------------------------------|
| `Usuarios`            | `usuario_id` (9 caracteres)         | cuenta, perfil, foto, privacidad y tema                           |
| `Ajustes_Pomodoro`    | `usuario_id` (1:1)                  | minutos de trabajo y descanso, ciclos hasta el descanso largo     |
| `Amigos`              | `amistad_id`                        | una fila por pareja: solicitud (`pending`) o amistad (`accepted`) |
| `Asignaturas`         | `asignatura_id`                     | asignaturas de cada usuario con su color                          |
| `Tareas`              | `tarea_id`                          | tareas personales                                                 |
| `Calificaciones`      | `calificacion_id` (`tarea_id` único)| nota de 0 a 10 de una tarea completada (1:1)                      |
| `Salas`               | `sala_id` (9 caracteres)            | sala de estudio; copia del nombre y color de su asignatura        |
| `Participantes_Salas` | (`sala_id`, `usuario_id`)           | quién está en cada sala y con qué rol (`admin`, `member`)         |
| `Invitaciones_Salas`  | (`sala_id`, `usuario_id`)           | invitaciones pendientes; al aceptarla pasa a participantes        |
| `Tareas_Sala`         | `tarea_sala_id`                     | tareas compartidas con responsable                                |
| `Mensajes_Salas`      | `mensaje_id`                        | chat de cada sala                                                 |
| `Archivos_Salas`      | `archivo_id`                        | metadatos de los archivos (el binario va en disco)                |
| `Notificaciones`      | `notificacion_id`                   | avisos con una instantánea JSON de nombres y títulos              |
| `Pomodoro`            | `pomodoro_id`                       | una fila por sesión de trabajo o descanso                         |

```
Usuarios ─┬─< Asignaturas ─< Tareas ─── Calificaciones (0..1)
          ├─< Tareas (usuario_id)
          ├── Ajustes_Pomodoro (1:1)
          ├─< Pomodoro >── Asignaturas (opcional)
          ├─< Amigos >── Usuarios            usuario_id envía, amigo_id recibe
          ├─< Notificaciones
          └─< Participantes_Salas >── Salas ─┬─< Invitaciones_Salas
                                             ├─< Tareas_Sala
                                             ├─< Mensajes_Salas
                                             └─< Archivos_Salas
```

### 4.2 Decisiones

- **Identificadores**: usuarios y salas usan un código aleatorio de 9 caracteres (`utils/ids.js`,
  sin `0/O` ni `1/I`) porque aparecen en URLs y no deben ser consecutivos ni revelar cuántos hay. El
  resto de tablas usa `integer GENERATED ALWAYS AS IDENTITY`. La API devuelve todos los ids como texto
  en `_id`.
- **Asignaturas 1:N y no N:M**: cada estudiante crea las suyas con su propio color y descripción, y
  nadie más las ve; una tabla intermedia `Usuarios_Asignaturas` obligaría a compartir el color. La tarea
  guarda `asignatura_id` (clave foránea) en lugar del nombre: renombrar una asignatura no deja tareas
  huérfanas y `ON DELETE SET NULL` deja sus tareas "sin asignatura" al borrarla.
- **Calificaciones**: tabla aparte 1:1 (`tarea_id UNIQUE`). Ni el usuario ni la asignatura se repiten
  en ella: se obtienen de la tarea.
- **Amigos**: una sola fila por pareja, con estado. El índice único sobre
  `(LEAST(usuario_id, amigo_id), GREATEST(usuario_id, amigo_id))` (con `COLLATE "C"`, para ordenar igual
  que JavaScript) impide dos filas aunque cada uno envíe una solicitud al otro a la vez.
- **Salas**: participantes, invitaciones y tareas en tablas propias. La asignatura de la sala es una
  copia (nombre y color) porque la original es privada de su dueño.
- **Contadores**: mensajes, archivos y tareas abiertas de cada sala se guardan en `Salas` y los
  mantienen triggers (`tr_contador_*`) en cualquier escritura, también en los borrados en cascada.
  Antes se calculaban con `COUNT`, que recorría todos los mensajes de la sala en cada listado y en
  cada cambio difundido.
- **Pomodoro**: una fila por sesión con el día local del usuario (`dia`); los totales del día y el
  historial salen de `SUM … GROUP BY dia`.
- **Tipos**: fechas `timestamptz` (la API las recibe y devuelve en ISO 8601 UTC), booleanos de verdad,
  notas `numeric(4,2)` y los datos de los avisos en `jsonb`. "Atrasada" no se guarda:
  `estado <> 'completed' AND fecha_entrega < ahora`.
- **Búsquedas**: `normalizar()` (minúsculas y sin tildes, con la extensión `unaccent`) para buscar
  tareas, e índices de trigramas (`pg_trgm`) para buscar personas por cualquier trozo de su nombre.
- **Valores cerrados** (tipos de tarea, urgencias, estados, colores, roles, tipos de aviso) con `CHECK`
  en la tabla. Son los mismos que `config/constants.js`.

### 4.3 Integridad en la base de datos

Además de las claves foráneas y los `CHECK`, el esquema tiene triggers (funciones PL/pgSQL) para las
reglas que cruzan tablas. Sus errores usan el SQLSTATE `P0001` y la API los devuelve como 409:

| Trigger                               | Regla                                                  |
|---------------------------------------|--------------------------------------------------------|
| `tr_tareas_asignatura_propia`         | la asignatura de una tarea es del mismo usuario        |
| `tr_calificaciones_solo_completadas`  | solo se califican tareas completadas                   |
| `tr_tareas_reabrir_borra_nota`        | reabrir una tarea borra su nota                        |
| `tr_invitaciones_no_participantes`    | no se invita a quien ya está en la sala                |
| `tr_participantes_salida_desasigna`   | quien sale de una sala deja sus tareas sin asignar     |
| `tr_contador_*`                       | mantienen `Salas.mensajes`, `archivos` y `tareas_abiertas` |

Las operaciones que tocan varias filas (registrar un usuario con sus ajustes, aceptar una invitación,
comprobar un límite y añadir) van dentro de una transacción (`transaction()` de `database/db.js`).
PostgreSQL ejecuta transacciones en paralelo, así que las que comprueban una regla y después escriben
empiezan bloqueando la fila que las ordena (`lockRow('sala', id)` o `lockRow('usuario', id)`, un
`SELECT … FOR UPDATE`): dos peticiones a la vez sobre la misma sala no pueden saltarse el máximo de
participantes ni dejarla sin administradores. Borrar una sala o un usuario arrastra todo lo que
depende de ellos con `ON DELETE CASCADE`.

### 4.4 Versiones del esquema

`schema.sql` describe siempre el esquema completo y actual: una base nueva se crea con él y queda en
la última versión (tabla `Version_Esquema`). Una base existente aplica antes las migraciones
pendientes de `database/migrations.js` (columnas nuevas, datos que rellenar) y después `schema.sql`,
que solo crea lo que falte. Todo va en una transacción con `pg_advisory_xact_lock`: si varias
máquinas arrancan a la vez, una aplica el esquema y las demás esperan.

La versión 0 es el esquema de PostgreSQL de la fase 4. Las versiones de SQLite (contadores de salas,
índice de búsqueda) ya están incluidas en él.

## 5. Índices

Además de las claves primarias y de los `UNIQUE` (`Usuarios.email`, `Usuarios.identificador`,
`Asignaturas(usuario_id, nombre_normalizado)`, `Calificaciones.tarea_id`):

| Índice                                  | Columnas                                               | Para qué                                    |
|-----------------------------------------|--------------------------------------------------------|---------------------------------------------|
| `ux_amigos_pareja` (único)              | `LEAST(usuario_id, amigo_id)`, `GREATEST(…)` (`COLLATE "C"`) | relación entre dos usuarios           |
| `ix_amigos_usuario`                     | `usuario_id, estado`                                   | solicitudes enviadas, lista de amigos       |
| `ix_amigos_amigo`                       | `amigo_id, estado`                                     | solicitudes recibidas, lista de amigos      |
| `ix_tareas_usuario_entrega`             | `usuario_id, fecha_entrega`                            | calendario, horizonte                       |
| `ix_tareas_usuario_estado`              | `usuario_id, estado, fecha_entrega`                    | pendientes, atrasadas, completadas          |
| `ix_tareas_asignatura`                  | `asignatura_id`                                        | filtro por asignatura, `ON DELETE SET NULL` |
| `ix_tareas_recordatorio` (parcial)      | `fecha_entrega`, sin aviso enviado ni completadas      | job de recordatorios                        |
| `ix_salas_sesion` (parcial)             | `fecha_sesion`                                         | próximas sesiones (agenda)                  |
| `ix_participantes_usuario`              | `usuario_id`                                           | "mis salas"                                 |
| `ix_invitaciones_usuario`               | `usuario_id`                                           | invitaciones pendientes                     |
| `ix_tareas_sala_sala`                   | `sala_id, tarea_sala_id`                               | tareas de una sala                          |
| `ix_tareas_sala_asignada`               | `usuario_id, fecha_entrega`                            | tareas asignadas (agenda)                   |
| `ix_mensajes_sala`                      | `sala_id, mensaje_id DESC`                             | historial paginado por cursor               |
| `ix_archivos_sala`                      | `sala_id, fecha_subida DESC`                           | listado de archivos                         |
| `ix_notificaciones_usuario`             | `usuario_id, notificacion_id DESC`                     | bandeja paginada                            |
| `ix_notificaciones_no_leidas` (parcial) | `usuario_id` con `NOT leida`                           | contador de no leídas                       |
| `ix_notificaciones_sala` (parcial)      | `sala_id`                                              | borrado en cascada de una sala              |
| `ix_notificaciones_fecha`               | `fecha_envio`                                          | limpieza de avisos de más de 180 días       |
| `ix_pomodoro_usuario_dia`               | `usuario_id, dia`                                      | sesiones de hoy, historial                  |
| `ix_usuarios_nombre_trgm` (GIN, `pg_trgm`) | `' ' \|\| nombre_busqueda`                        | buscar personas por principio de palabra    |
| `ix_usuarios_identificador_trgm` (GIN, `pg_trgm`) | `identificador`                              | buscar por identificador                    |

## 6. API REST

Todas las rutas cuelgan de `/api`, devuelven JSON y, salvo registro y login, requieren sesión.
Errores: `{ error: { message, code, fields? } }` con 400, 401, 403, 404, 409, 413, 422, 429 o 500.

| Recurso         | Método y ruta                                          | Descripción                                    |
|-----------------|--------------------------------------------------------|------------------------------------------------|
| Autenticación   | `POST /auth/register` · `POST /auth/login`             | crea sesión (201 / 200)                        |
|                 | `POST /auth/logout` · `GET /auth/me`                   | cierra sesión (204) / usuario actual           |
|                 | `PATCH /auth/password`                                 | cambia contraseña y renueva la sesión          |
| Usuarios        | `GET /users/search?q=`                                 | por nombre o identificador, respeta privacidad |
|                 | `GET /users/handle/:handle`                            | perfil público según privacidad                |
|                 | `PATCH /users/me` · `/me/privacy` · `/me/preferences`  | datos, privacidad, preferencias                |
|                 | `PUT /users/me/avatar` · `DELETE /users/me/avatar`     | foto (multipart)                               |
|                 | `GET /users/:userId/avatar`                            | foto (requiere sesión)                         |
| Asignaturas     | `GET/POST /subjects` · `PATCH/DELETE /subjects/:id`    | CRUD de asignaturas                            |
| Tareas          | `GET /tasks` (filtros, búsqueda, paginación)           |                                                |
|                 | `GET /tasks/summary`                                   | contadores por estado                          |
|                 | `POST /tasks` · `GET/PATCH/DELETE /tasks/:id`          |                                                |
|                 | `POST /tasks/:id/complete` · `POST /tasks/:id/reopen`  | completar (con nota opcional) / reabrir        |
| Calificaciones  | `GET /grades` · `GET /grades/stats`                    | notas y estadísticas                           |
|                 | `PUT /grades/:taskId` · `DELETE /grades/:taskId`       | registrar / quitar nota                        |
| Amigos          | `GET /friends` · `DELETE /friends/:userId`             |                                                |
|                 | `GET /friends/requests` · `POST /friends/requests`     |                                                |
|                 | `POST /friends/requests/:id/accept` · `DELETE /friends/requests/:id` |                                  |
| Salas           | `GET/POST /rooms` · `GET /rooms/invitations` · `GET /rooms/agenda` |                                    |
|                 | `GET/PATCH/DELETE /rooms/:roomId`                      |                                                |
|                 | `POST /rooms/:roomId/invitations` (+ `/accept`, `/decline`) · `DELETE …/invitations/:userId` |        |
|                 | `PATCH/DELETE /rooms/:roomId/members/:userId`          | rol / expulsar o salir                         |
|                 | `GET/POST /rooms/:roomId/tasks` · `PATCH/DELETE …/tasks/:taskId` |                                      |
| Mensajes        | `GET/POST /rooms/:roomId/messages` · `PATCH/DELETE …/:messageId` | cursor `?before=`                    |
| Archivos        | `GET/POST /rooms/:roomId/files` · `GET …/:fileId/download` · `DELETE …/:fileId` |                       |
| Notificaciones  | `GET /notifications` · `GET /notifications/unread-count` |                                              |
|                 | `PATCH /notifications/:id` · `POST /notifications/read-all` · `DELETE /notifications/:id` |              |
| Pomodoro        | `GET/PUT /pomodoro/settings` · `POST /pomodoro/sessions` |                                              |
|                 | `GET /pomodoro/today?day=` · `GET /pomodoro/history`   |                                                |
| Dashboard       | `GET /dashboard`                                       | todo lo de la pantalla Hoy en una petición     |
| Estado          | `GET /health`                                          | servidor, base de datos y bucle de eventos (sin sesión) |

**Eventos Socket.IO** (solo difusión; las escrituras van por REST): `room:join`, `room:leave`,
`room:typing` (cliente → servidor); `message:new`, `message:updated`, `message:deleted`,
`room:patch`, `room:files`, `room:removed`, `room:deleted`, `notification:new` (servidor → cliente).
Socket.IO usa solo WebSocket (sin *long-polling*), así cada conexión vive entera en un proceso.
`room:patch` lleva solo lo que ha cambiado en la sala (sus datos, participantes, invitaciones o una
tarea); quien hace el cambio recibe la sala completa en la respuesta REST.

## 7. Navegación

```
Escritorio y portátil (≥ 1100px)          Tablet (768–1099px)        Móvil (< 768px)
┌─────────┬────────────────────────┐      ┌────┬──────────────────┐   ┌──────────────────────┐
│ marca   │                        │      │ ◇  │                  │   │ Título        🔔  ◯  │
│ Hoy    ═╪═ hoja de contenido     │      │ ◇ ═╪═ hoja            │   ├──────────────────────┤
│ Tareas  │                        │      │ ◇  │                  │   │                      │
│ Calend. │                        │      │ ◇  │                  │   │      contenido       │
│ Asign.  │                        │      │    │                  │   │                      │
│ Notas   │                        │      │ ◇  │                  │   ├──────────────────────┤
│ Salas   │                        │      │ ◇  │                  │   │ Hoy Tareas ＋ Cal Más │
│ Amigos  │                        │      │ ◇  │                  │   └──────────────────────┘
│ Pomodoro│                        │      │    │                  │
│ ⏱ 18:42 │                        │      │ 🔔 │                  │
│ 🔔  ◯   │                        │      │ ◯  │                  │
└─────────┴────────────────────────┘      └────┴──────────────────┘
```

- La sección activa del rail es una **pestaña de separador** que se funde con la hoja de contenido.
- Grupos: *Tu semestre* (Hoy, Tareas, Calendario, Asignaturas, Notas), *Con otros* (Salas, Amigos),
  *Foco* (Pomodoro). Avisos y perfil quedan en el pie del rail.
- En móvil: barra inferior con las acciones diarias y un botón central para añadir tarea; el resto en
  una hoja "Más". El chat de una sala oculta la barra inferior para ganar altura.
- El temporizador Pomodoro en marcha aparece en el rail (o sobre la barra inferior en móvil) en
  cualquier página.

## 8. Sistema visual

**Tema**: los apuntes de un estudiante. Tinta negra sobre papel frío (y papel negro en modo oscuro) y marcadores
fluorescentes para lo que importa ahora. El color de cada asignatura es un fluorescente, como los
subrayados de unos apuntes.

| Token          | Claro     | Oscuro    | Uso                                              |
|----------------|-----------|-----------|--------------------------------------------------|
| `--canvas`     | `#E9ECF3` | `#0A0A0B` | fondo bajo la hoja y el rail                     |
| `--sheet`      | `#FFFFFF` | `#141416` | hoja de contenido                                |
| `--ink`        | `#141416` | `#EDEDEF` | texto principal, botones primarios               |
| `--ink-2`      | `#55555C` | `#A5A5AC` | texto secundario                                 |
| `--rule`       | `#DADEEA` | `#2A2A2F` | separadores y bordes de campos                   |
| `--marker`     | `#F7E641` | `#F7E641` | subrayado de estado: hoy, siguiente, selección   |
| `--red-pen`    | `#C8243A` | `#FF6B7A` | atrasadas y acciones destructivas                |

Fluorescentes de asignatura: amarillo, rosa, verde, naranja, azul, lila, menta y coral.

**Tipografía**: una sola familia, *Recursive* (variable). El eje `CASL` hace de contraste: titulares y
cifras grandes en Recursive Casual de peso alto, que recuerda a rotulador; interfaz y texto en
Recursive Linear. Escala: 12 · 14 · 16 · 18 · 21 · 24 · 36 · 48 · 72.

**Principios**

1. La tinta estructura, el fluorescente señala. El marcador solo aparece en lo que es *ahora*,
   *siguiente* o *seleccionado*; si todo está subrayado, nada lo está.
2. El rojo de corrección es exclusivo de lo atrasado y de lo destructivo.
3. Nada de cuadrícula de tarjetas: las secciones viven en la hoja separadas por espacio y títulos.
4. Los titulares cuentan datos reales ("Tienes 3 entregas esta semana") en lugar de rótulos genéricos.
5. El elemento memorable es el **horizonte** del dashboard: las próximas dos semanas como columnas de
   días con las entregas marcadas en el color de su asignatura.

**Revisión frente a lo genérico**: la primera idea era un dashboard con fichas de KPI (media, completadas,
pendientes). Se sustituyó por el horizonte de 14 días y por barras de media por asignatura con la media
general como línea de referencia, que muestran comparación y no solo un número. También se descartó el
azul primario típico de apps educativas: la tinta es negra y el azul queda solo como acento de las
gráficas y del foco.

## 9. Rendimiento y escalabilidad

Cada proceso de Node tiene un solo hilo: el trabajo de CPU de cada petición tiene que ser pequeño y lo
caro sale del hilo principal. Con PostgreSQL, además, cada consulta es un viaje de red: lo que cuenta
es cuántas consultas hace cada petición y que las independientes vayan en paralelo (`Promise.all`).

**Lo que ya está hecho**

| Medida | Dónde |
|--------|-------|
| Grupo de conexiones a PostgreSQL abierto al arrancar, sentencias preparadas y consultas independientes en paralelo | `database/db.js`, servicios |
| bcrypt nativo: el hash va al pool de hilos de libuv, ampliado según los núcleos | `auth/password.js`, `config/threadpool.js` |
| Límites por usuario con sesión; por IP solo sin sesión; login limitado por cuenta y por IP | `middleware/security.js` |
| Compresión (brotli calidad 4) y caché de un año para los assets con hash | `app.js` |
| Contadores de las salas mantenidos por triggers | `schema.sql` |
| Formateadores de `Intl` y clave del JWT creados una sola vez | `grade.service.js`, `auth/tokens.js` |
| Estadísticas académicas: semanas calculadas una vez por consulta y caché de 30 s por usuario que invalidan sus escrituras | `grade.service.js`, `academicCache.js` |
| Usuario y asignaturas en una sola consulta por petición (`json_agg`) | `models/user.model.js` |
| Dashboard: solo las 4 salas y 8 amigos que muestra, más los totales, y todo en paralelo | `dashboard.service.js` |
| Cambios de sala difundidos como parches pequeños (`room:patch`), sin recargas en cadena en los clientes | `room.service.js`, `utils/rooms.js` |
| Búsqueda de personas con índices de trigramas | `schema.sql`, `user.service.js` |
| Cliente: un minuto de frescura de datos, sondeo de avisos cada 15 min solo como respaldo, páginas de 200 tareas | `App.jsx`, hooks |
| Registro de consultas lentas, monitor del bucle de eventos y `/api/health` | `database/db.js`, `utils/eventLoop.js` |
| Datos y script de prueba de carga (también contra varios servidores) | `seed/load-seed.js`, `scripts/load-test.mjs` |
| Varios procesos (cluster) y varias máquinas (Redis + S3), ver abajo | `server.js`, `worker.js`, `cluster/`, `infra/`, `uploads/` |

Resultados medidos en el README (sección "Pruebas de carga").

**Varios procesos en una máquina (`WORKERS`)**

```
                  ┌──────────────────────────── proceso principal (cluster/primary.js) ──┐
 conexiones ────▶ │ acepta y reparte por turnos · sin Redis: límites y avisos entre ellos │
                  └───────┬───────────────────────┬───────────────────────┬──────────────┘
                          ▼                       ▼                       ▼
                     proceso 0               proceso 1      …        proceso N-1
                     (recordatorios)
                     Express + Socket.IO + su grupo de conexiones a PostgreSQL
```

- **Reparto**: el `cluster` de Node en modo rotatorio (`SCHED_RR`, también en Windows). El principal
  solo acepta cada conexión y la entrega; después el proceso la lee y responde directamente.
- **Base de datos**: cada proceso abre su grupo de conexiones (`DATABASE_POOL_SIZE`). El principal
  aplica el esquema antes de arrancar los procesos.
- **Socket.IO**: solo WebSocket, así que no necesita sesiones *sticky*.
- **Fallos**: el principal reinicia un proceso caído con el mismo índice (esperando más si cae en
  bucle). Si el principal desaparece, los procesos se cierran en vez de quedarse huérfanos.

**Varias máquinas (`REDIS_URL` y `S3_BUCKET`)**

```
                         balanceador (WebSocket, sin sesiones sticky)
              ┌──────────────────┬───────────────────┬──────────────────┐
              ▼                  ▼                   ▼                  ▼
          servidor A         servidor B          servidor C          …      (cada uno con WORKERS)
              └──────────────────┴─────────┬─────────┴──────────────────┘
                     PostgreSQL (datos) · Redis (coordinación) · S3 (archivos)
```

Cada pieza que en una máquina coordinaba el proceso principal pasa a Redis:

| Qué | Una máquina | Varias máquinas |
|-----|-------------|-----------------|
| Eventos de Socket.IO entre procesos | `@socket.io/cluster-adapter` (IPC) | `@socket.io/redis-adapter` |
| Contadores de los límites de peticiones | `@express-rate-limit/cluster-memory-store` | `rate-limit-redis` |
| Invalidación de cachés (`cluster/bus.js`) | IPC a través del principal | canal de Redis |
| Fotos y archivos (`uploads/objectStore.js`) | disco (`UPLOAD_DIR`) | S3: subida desde la API, descarga con enlace firmado de 60 s |
| Recordatorios | proceso 0 | proceso 0 de cada máquina; cada tarea se reclama con `FOR UPDATE SKIP LOCKED` |
| Esquema al arrancar | lo aplica el principal | `pg_advisory_xact_lock`: lo aplica el primero en llegar |

Probado con dos servidores independientes en la misma máquina: sesiones, chat, parches de sala,
límites, cachés, archivos, fotos y recordatorios funcionan cruzados entre ellos (ver el README).

**Siguientes pasos, si hiciera falta más**

1. Menos viajes a PostgreSQL por petición: guardar en memoria el usuario de la sesión unos segundos
   (invalidándolo por el bus al cambiarlo), que hoy es una consulta en cada petición.
2. PgBouncer delante de PostgreSQL cuando la suma de conexiones de todos los procesos se acerque a
   `max_connections`, y réplicas de lectura para las consultas pesadas (estadísticas, búsquedas).
3. CDN delante del frontend compilado y de las descargas de S3.

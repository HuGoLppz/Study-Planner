# STUDY-PLANNER — Arquitectura y decisiones de diseño

Este documento recoge el análisis previo a la implementación: arquitectura, estructura de carpetas,
modelo documental de MongoDB, índices, API, navegación y sistema visual.

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
- Las estadísticas (medias, evolución, progreso) se calculan con el **aggregation pipeline** de
  MongoDB, no en el cliente ni con datos precalculados que puedan quedar desfasados.
- El chat necesita **Socket.IO**; las escrituras siguen pasando por la API REST (validación y
  permisos en un único punto) y el socket solo difunde los cambios.
- Los archivos se guardan en disco (fuera de cualquier carpeta pública) y en MongoDB solo los metadatos.
- Todos los estados derivados (por ejemplo, "atrasada") se calculan a partir de datos reales; nunca se
  almacenan, para que no puedan contradecirse.

## 2. Arquitectura

```
┌──────────────────────────┐     REST /api (JSON, cookie httpOnly)    ┌──────────────────────────┐
│  client/  React + Vite   │ ───────────────────────────────────────▶ │  server/  Node + Express │
│  React Router            │                                          │  routes → controllers    │
│  TanStack Query (cache)  │ ◀─────────── Socket.IO (eventos) ─────── │  → services → models     │
│  Zustand (estado local)  │                                          │  Mongoose                │
└──────────────────────────┘                                          └────────────┬─────────────┘
                                                                                   │
                                                          ┌────────────────────────┴───────┐
                                                          │ MongoDB (local o Atlas)        │
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
│       ├── server.js         arranque: BD, HTTP, Socket.IO, tareas programadas
│       ├── app.js            Express: seguridad, parsers, rutas, errores
│       ├── config/           variables de entorno validadas y constantes de dominio
│       ├── database/         conexión a MongoDB
│       ├── models/           esquemas Mongoose
│       ├── auth/             contraseñas, tokens y cookies
│       ├── middleware/       auth, validación, acceso a salas, errores, límites
│       ├── validators/       esquemas zod por recurso
│       ├── routes/           un router por recurso
│       ├── controllers/      adaptadores HTTP
│       ├── services/         lógica de negocio
│       ├── serializers/      qué se expone de cada documento
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
        ├── styles/           tokens, base y utilidades
        ├── layouts/          AppLayout (rail, barra inferior), AuthLayout
        ├── pages/            una página por ruta
        ├── components/       ui/ (primitivas) y componentes por dominio
        ├── hooks/            hooks de datos (React Query) y de interfaz
        ├── services/         cliente HTTP y funciones por recurso, socket
        ├── store/            Zustand (UI y Pomodoro)
        ├── context/          AuthProvider
        └── utils/            fechas, formato, reglas de tareas, constantes
```

## 4. Modelo documental de MongoDB

Se parte de las 12 entidades conceptuales y se decide para cada una si se embebe, se referencia o se
agrupa, según cómo se lee y se escribe en la aplicación. Resultado: **8 colecciones**.

| Entidad conceptual        | Decisión                                       | Dónde                         |
|---------------------------|------------------------------------------------|-------------------------------|
| Usuarios                  | Colección                                      | `users`                       |
| Asignaturas               | **Embebidas** en el usuario                    | `users.subjects[]`            |
| Tareas                    | Colección, referencia al dueño                 | `tasks`                       |
| Calificaciones            | **Embebidas** en la tarea (1:1)                | `tasks.grade`                 |
| Relaciones de amistad     | Colección de aristas (1 documento por pareja)  | `friendships`                 |
| Salas                     | Colección                                      | `rooms`                       |
| Participantes de salas    | **Embebidos** con su rol                       | `rooms.members[]`             |
| Invitaciones a salas      | **Embebidas**                                  | `rooms.invitations[]`         |
| Tareas colaborativas      | **Embebidas**                                  | `rooms.tasks[]`               |
| Mensajes                  | Colección, referencia a sala y autor           | `messages`                    |
| Archivos                  | Colección de metadatos; binario en disco       | `roomfiles`                   |
| Notificaciones            | Colección con instantánea de datos             | `notifications`               |
| Sesiones Pomodoro         | **Patrón bucket**: un documento por usuario y día | `pomodorodays`             |

### 4.1 `users`

```js
{
  _id, name, email, passwordHash /* select:false */, tokenVersion /* select:false */,
  handle,                 // identificador público único: "hugo.lopez"
  searchTokens: [String], // nombre normalizado y troceado para búsqueda por prefijo
  studies, course, bio,
  avatar: { fileName, mimeType, updatedAt },   // WebP 256×256 optimizado en el servidor
  privacy: { profileVisibility: 'public'|'friends'|'private', searchable: Boolean, showGrades: Boolean },
  preferences: {
    theme: 'system'|'light'|'dark',
    pomodoro: { focusMinutes, breakMinutes, longBreakMinutes, cyclesBeforeLongBreak }
  },
  subjects: [{ _id, name, description, color, createdAt, updatedAt }],
  createdAt, updatedAt
}
```

**Por qué las asignaturas van embebidas**: son pocas (límite de 40), pertenecen a un único usuario,
nunca se consultan sin su dueño y se necesitan en casi todas las pantallas. Llegan con `GET /auth/me`
y el cliente las tiene siempre en memoria sin peticiones extra. Las tareas guardan solo el `_id` de la
asignatura; al borrar una asignatura se hace un `updateMany` que deja esas tareas sin asignatura.

**Por qué `searchTokens`**: buscar "lop" debe encontrar "Hugo López". Un índice multikey sobre los
tokens normalizados (sin tildes, en minúsculas) permite consultas `^lop` que usan el índice, sin
depender de un índice de texto que no hace coincidencias por prefijo.

### 4.2 `tasks`

```js
{
  _id, owner: ObjectId(User), title, description,
  subject: ObjectId | null,   // _id de users.subjects
  type: 'exam'|'assignment'|'project'|'reading'|'practice'|'presentation'|'other',
  priority: 'low'|'medium'|'high',
  status: 'pending'|'in_progress'|'completed',
  dueDate, completedAt,
  grade: { score: 0..10, gradedAt },   // solo si está completada
  reminderSentAt,
  createdAt, updatedAt                 // createdAt = fecha de creación
}
```

Las tareas no se embeben en el usuario porque crecen sin límite, se escriben de forma independiente y
se consultan por rangos de fechas con filtros. **La calificación sí se embebe**: es 1:1 con la tarea,
no existe sin ella y así las estadísticas son un único pipeline sobre `tasks`.

"Atrasada" no se guarda: es `status != completed && dueDate < ahora`.

### 4.3 `friendships`

```js
{ _id, pairKey: "idA:idB" /* ordenados, único */, users: [idA, idB],
  requester, recipient, status: 'pending'|'accepted', acceptedAt, createdAt }
```

La amistad es simétrica y tiene ciclo de vida (pendiente → aceptada). Guardarla en un único documento
hace que **cada transición sea una escritura atómica sobre un solo documento**, sin transacciones
multi-documento (no disponibles en un MongoDB local sin réplica). `pairKey` único impide duplicados y
condiciones de carrera cuando dos personas se envían solicitud a la vez.

### 4.4 `rooms`

```js
{
  _id, name, description, scheduledAt,
  subject: { name, color },             // instantánea de la asignatura del creador
  createdBy,
  members:     [{ user, role: 'admin'|'member', joinedAt }],     // máx. 50
  invitations: [{ user, invitedBy, createdAt }],
  tasks:       [{ _id, title, description, dueDate, assignee, status, createdBy, completedAt, createdAt, updatedAt }], // máx. 200
  stats: { messages, files },           // contadores mantenidos con $inc
  lastActivityAt, createdAt, updatedAt
}
```

- **Participantes y administradores** son el mismo array con un rol: se leen siempre con la sala, están
  acotados y la comprobación de permisos es una búsqueda en memoria.
- **Aceptar una invitación** es un único `findOneAndUpdate` que hace `$pull` de `invitations` y `$push`
  a `members`: la transición es atómica.
- **Tareas colaborativas embebidas**: solo existen dentro de su sala, se muestran siempre juntas y están
  acotadas. Se actualizan con el operador posicional (`tasks.$`) y `arrayFilters`, nunca reescribiendo
  el array completo.
- **La asignatura es una instantánea** porque las asignaturas son privadas de cada usuario: los demás
  participantes no la tienen.

### 4.5 `messages` y `roomfiles`

Crecen sin límite y se paginan, así que van en colecciones propias con referencia a la sala. El autor
se referencia y se resuelve con `populate` (una única consulta `$in` por página), para que un cambio de
nombre o foto se vea en todo el historial. Los binarios se guardan en `uploads/rooms/<roomId>/` con
nombre aleatorio; `roomfiles` guarda nombre original, tipo, tamaño, autor y fecha.

### 4.6 `notifications`

```js
{ _id, recipient, type, actor, room, task, data: { actorName, roomName, taskTitle, … },
  read, readAt, createdAt }
```

Una notificación describe un hecho pasado, así que guarda una **instantánea** (`data`) para poder
pintarse sin joins aunque el nombre de la sala cambie después. Un índice TTL las elimina a los 180 días.

### 4.7 `pomodorodays` — patrón bucket

```js
{ _id, user, day: 'YYYY-MM-DD',
  sessions: [{ phase: 'focus'|'break', plannedSeconds, actualSeconds, completed, startedAt, endedAt, subject }],
  totals: { focusSeconds, breakSeconds, completedFocus } }
```

Las sesiones son datos de serie temporal pequeños y numerosos. Agruparlas por día hace que "hoy" sea un
documento y "últimos 7 días" sean 7, y cada sesión nueva es un `upsert` con `$push` + `$inc` atómico.

## 5. Índices

| Colección        | Índice                                             | Para qué                                   |
|------------------|----------------------------------------------------|--------------------------------------------|
| users            | `email` único                                      | login, registro                            |
| users            | `handle` único                                     | perfil por identificador, búsqueda `^`     |
| users            | `searchTokens` (multikey)                          | búsqueda por nombre con prefijo            |
| tasks            | `{ owner, dueDate }`                               | calendario, próximas entregas              |
| tasks            | `{ owner, status, dueDate }`                       | pendientes / atrasadas / completadas (ESR) |
| tasks            | `{ owner, 'grade.gradedAt' }` parcial (con nota)    | listado de calificaciones                  |
| tasks            | `{ reminderSentAt, dueDate }`                      | job de recordatorios                       |
| friendships      | `pairKey` único                                    | estado entre dos usuarios                  |
| friendships      | `{ users, status }`                                | lista de amigos                            |
| friendships      | `{ recipient, status }`                            | solicitudes recibidas                      |
| rooms            | `{ 'members.user', lastActivityAt: -1 }`           | "mis salas" ordenadas por actividad        |
| rooms            | `invitations.user`                                 | invitaciones pendientes                    |
| rooms            | `{ 'tasks.assignee', 'tasks.dueDate' }`            | tareas de sala asignadas (agenda)          |
| rooms            | `scheduledAt`                                      | próximas sesiones                          |
| messages         | `{ room, _id: -1 }`                                | historial paginado por cursor              |
| roomfiles        | `{ room, createdAt: -1 }`                          | listado de archivos                        |
| notifications    | `{ recipient, _id: -1 }`                           | bandeja paginada                           |
| notifications    | `{ recipient, read }`                              | contador de no leídas                      |
| notifications    | `createdAt` TTL 180 días                           | limpieza automática                        |
| pomodorodays     | `{ user, day }` único                              | bucket del día, historial                  |

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
| Asignaturas     | `GET/POST /subjects` · `PATCH/DELETE /subjects/:id`    | CRUD sobre `users.subjects`                    |
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

**Eventos Socket.IO** (solo difusión; las escrituras van por REST): `room:join`, `room:leave`,
`room:typing` (cliente → servidor); `message:new`, `message:updated`, `message:deleted`,
`room:updated`, `room:files`, `notification:new` (servidor → cliente).

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

**Tema**: los apuntes de un estudiante. Tinta de bolígrafo azul sobre papel frío y marcadores
fluorescentes para lo que importa ahora. El color de cada asignatura es un fluorescente, como los
subrayados de unos apuntes.

| Token          | Claro     | Oscuro    | Uso                                              |
|----------------|-----------|-----------|--------------------------------------------------|
| `--canvas`     | `#E9ECF3` | `#0C0F27` | fondo bajo la hoja y el rail                     |
| `--sheet`      | `#FFFFFF` | `#161A3A` | hoja de contenido                                |
| `--ink`        | `#1B2463` | `#E7E8F4` | texto principal, botones primarios               |
| `--ink-2`      | `#525A8A` | `#A6AACB` | texto secundario                                 |
| `--rule`       | `#DADEEA` | `#2B3163` | separadores y bordes de campos                   |
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
azul primario típico de apps educativas: la tinta es un azul bolígrafo muy oscuro usado como "negro" del
sistema, no como color de acento.

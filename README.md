# Study Planner

Plataforma de organización académica y colaboración entre estudiantes. Reúne en un solo sitio
tareas, asignaturas, calendario, notas y estadísticas, amigos, salas de estudio con chat en tiempo
real y archivos compartidos, notificaciones y un temporizador Pomodoro.

- **Frontend**: React 19 + Vite + React Router (`client/`)
- **Backend**: Node.js + Express 5 + Socket.IO (`server/`)
- **Base de datos**: PostgreSQL (relacional). Opcionales para varias máquinas: Redis y almacenamiento compatible con S3

El análisis previo, el modelo relacional, los índices, la API completa, la navegación y el sistema
visual están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Funcionalidades

| Área | Qué permite |
|------|-------------|
| Cuenta | Registro en dos pasos (cuenta y estudios), inicio y cierre de sesión, sesión persistente, cambio de contraseña |
| Hoy | Titular con tu semana real, horizonte de 14 días, atrasadas, próximas entregas, eventos de salas, medias, progreso, Pomodoro, salas, amigos y avisos |
| Tareas | Crear, editar, completar, reabrir, eliminar, buscar y filtrar por estado, asignatura, tipo y urgencia; agrupadas por tramos de tiempo |
| Calendario | Mes, semana y agenda en escritorio; tira semanal o mes con puntos + lista del día en móvil; tareas propias, sesiones de sala y tareas asignadas |
| Asignaturas | CRUD con color fluorescente; se usan en tareas, notas y estadísticas |
| Notas | Nota de 0 a 10 al completar; media general y por asignatura, evolución, progreso, ritmo semanal y registro completo |
| Amigos | Búsqueda por nombre o identificador, solicitudes, perfiles públicos que respetan la privacidad |
| Salas | Creación, invitaciones a amigos, roles de administración, tareas compartidas con responsable, chat en tiempo real, archivos |
| Avisos | Solicitudes, invitaciones, tareas asignadas y entregas próximas; leído/no leído, acciones directas |
| Pomodoro | Tiempos configurables, ciclos, descanso largo, reloj, historial; sigue en marcha aunque cambies de página |
| Perfil | Foto, datos, identificador, privacidad, tema claro/oscuro, resumen académico |

---

## Tecnologías

**Cliente**: React, Vite, React Router, TanStack Query (caché y sincronización con la API), Zustand
(estado de interfaz y temporizador), React Hook Form + Zod (formularios y validación), Radix UI
(diálogos, menús, pestañas y tooltips accesibles), Sonner (avisos), date-fns, Socket.IO Client,
Phosphor Icons y la tipografía variable Recursive (autoalojada con Fontsource).

**Servidor**: Express 5, PostgreSQL (`pg`), Socket.IO, Redis (`redis`, opcional), AWS SDK para S3 (opcional), bcrypt (nativo), JSON Web Tokens en cookie `httpOnly`,
Zod (validación), Multer (subidas), Helmet, CORS y express-rate-limit.

---

## Estructura del proyecto

```
Study-Planner/
├── package.json            scripts para ejecutar todo desde la raíz
├── docker-compose.yml      PostgreSQL, Redis y S3 (SeaweedFS) para desarrollo
├── docker/                 configuración de esos servicios
├── scripts/                dev.mjs (API y web a la vez) y load-test.mjs (prueba de carga)
├── docs/ARCHITECTURE.md    análisis, modelo de datos, índices, API, navegación y diseño
├── server/
│   ├── .env.example
│   ├── uploads/            archivos subidos si no se usa S3 (fuera de git)
│   └── src/
│       ├── server.js       arranque: un proceso o cluster según WORKERS
│       ├── worker.js       un proceso de la API (BD, HTTP, Socket.IO, recordatorios)
│       ├── cluster/        proceso principal, papel de cada proceso y mensajes entre ellos
│       ├── app.js          Express: seguridad, rutas y errores
│       ├── config/         variables de entorno y constantes
│       ├── database/       conexión a PostgreSQL, esquema (schema.sql), migraciones e importador de SQLite
│       ├── models/         columnas y conversión de filas a objetos de la API
│       ├── auth/           contraseñas, tokens, cookies y sesión
│       ├── middleware/     autenticación, validación, acceso a salas, seguridad, errores
│       ├── validators/     esquemas zod por recurso
│       ├── routes/         un router por recurso
│       ├── controllers/    adaptadores HTTP
│       ├── services/       lógica de negocio
│       ├── serializers/    datos públicos de cada usuario
│       ├── uploads/        multer, tipos permitidos, firmas binarias y almacenamiento (disco o S3)
│       ├── infra/          conexión a Redis
│       ├── sockets/        Socket.IO y emisores
│       ├── jobs/           recordatorios de entregas
│       ├── utils/          utilidades
│       └── seed/           datos de demostración (solo desarrollo)
└── client/
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx, router.jsx
        ├── styles/         tokens.css (valores de diseño) y app.css (todos los estilos)
        ├── layouts/        AppLayout (rail, barras móviles), AuthLayout, guardas de ruta
        ├── pages/          una página por ruta
        ├── components/     ui/ y componentes por dominio (tasks, calendar, rooms, charts…)
        ├── hooks/          hooks de datos y de interfaz
        ├── services/       cliente HTTP, recursos de la API y socket
        ├── store/          Zustand (interfaz, confirmaciones, Pomodoro)
        ├── context/        AuthProvider
        └── utils/          fechas, formato, reglas de tareas, calendario
```

---

## Requisitos

- **Node.js 20.19 o superior** (probado con Node 24)
- **PostgreSQL 14 o superior**. Para desarrollo, el repositorio trae un `docker-compose.yml`: basta con
  tener [Docker](https://www.docker.com/products/docker-desktop/) instalado.
- Solo para repartir la API entre varias máquinas: **Redis** y un almacenamiento **compatible con S3**
  (también incluidos en `docker-compose.yml`).

---

## Instalación

```bash
git clone <url-del-repositorio> Study-Planner
cd Study-Planner
npm run install:all
```

`install:all` instala las dependencias del servidor y del cliente. También puedes hacerlo por separado:

```bash
npm install --prefix server
npm install --prefix client
```

---

## Base de datos (PostgreSQL)

Para desarrollo, `docker-compose.yml` levanta PostgreSQL 17 con la base `study_planner` (usuario
`study_planner`, contraseña `study_planner_dev`, solo accesible desde tu máquina):

```bash
npm run services:up
```

Al arrancar, la API aplica el esquema de
[`server/src/database/schema.sql`](server/src/database/schema.sql) (tablas, claves foráneas,
restricciones, triggers e índices) y las migraciones pendientes. Es idempotente: se puede ejecutar en
cada arranque sin perder datos.

- **PostgreSQL gestionado** (Neon, Supabase, Render, Railway, Amazon RDS…): crea una base, copia su
  URL de conexión en `DATABASE_URL` y añade `?sslmode=require` si el proveedor lo pide. El esquema usa
  las extensiones `unaccent` y `pg_trgm`, que la API crea sola; todos estos proveedores las admiten.
- **Ver o consultar los datos**: `docker compose exec postgres psql -U study_planner study_planner`, o
  cualquier cliente (pgAdmin, DBeaver, la extensión de PostgreSQL de VS Code).
- **Copia de seguridad**: `docker compose exec postgres pg_dump -U study_planner study_planner > copia.sql`.
- **Empezar de cero**: `docker compose down -v` borra los datos de los contenedores.
- **Venir de la versión SQLite**: `npm run db:import-sqlite` copia `server/data/study-planner.db` a
  PostgreSQL con los mismos identificadores (enlaces, sesiones y archivos siguen valiendo). Solo
  trabaja sobre una base de PostgreSQL vacía y no modifica la de SQLite.

---

## Variables de entorno

### Servidor (`server/.env`)

Copia el ejemplo y rellénalo:

```bash
cp server/.env.example server/.env
```

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL: `postgres://usuario:contraseña@servidor:5432/base` |
| `JWT_SECRET` | Sí | Secreto para firmar sesiones; mínimo 32 caracteres aleatorios |
| `DATABASE_POOL_SIZE` | No | Conexiones a PostgreSQL de cada proceso de la API (por defecto `10`) |
| `REDIS_URL` | Con varias máquinas | Redis: `redis://servidor:6379`. Coordina Socket.IO, límites y cachés entre servidores |
| `S3_BUCKET` | Con varias máquinas | Bucket para fotos y archivos. Sin él, se guardan en `UPLOAD_DIR` |
| `S3_ENDPOINT` | No | Servicio compatible con S3 que no sea AWS (Cloudflare R2, Backblaze, MinIO, SeaweedFS…) |
| `S3_REGION` | No | Región del bucket (por defecto `us-east-1`; `auto` en R2) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Con `S3_BUCKET` | Credenciales del bucket |
| `S3_FORCE_PATH_STYLE` | No | `true` para servicios que no admiten el bucket como subdominio (MinIO, SeaweedFS) |
| `S3_CREATE_BUCKET` | No | `true` para crear el bucket si no existe (solo desarrollo) |
| `NODE_ENV` | No | `development` o `production` |
| `PORT` | No | Puerto de la API (por defecto `4000`) |
| `SESSION_DAYS` | No | Duración de la sesión en días (por defecto `7`) |
| `CLIENT_ORIGIN` | No | Orígenes permitidos por CORS, separados por comas |
| `COOKIE_SAMESITE` | No | `lax` (por defecto), `strict` o `none` |
| `COOKIE_SECURE` | No | `true` para exigir HTTPS (por defecto, solo en producción) |
| `TRUST_PROXY` | En producción, sí | Número de proxies delante del servidor (Render, Railway, nginx…). Si se deja en `0` detrás de un proxy, todos los usuarios parecen la misma IP |
| `UPLOAD_DIR` | No | Carpeta de archivos subidos (por defecto `uploads`) |
| `MAX_FILE_SIZE_MB` | No | Tamaño máximo de archivo de sala (por defecto `10`) |
| `MAX_AVATAR_SIZE_MB` | No | Tamaño máximo de la foto de perfil que se sube (por defecto `8`); se guarda optimizada |
| `SERVE_CLIENT` | No | `true` para que Express sirva el frontend compilado |
| `CLIENT_DIST` | No | Ruta al frontend compilado (por defecto `../client/dist`) |
| `COMPRESSION` | No | `false` para no comprimir en Node cuando ya lo hace un proxy o CDN (por defecto `true`) |
| `RATE_LIMIT_API` | No | Peticiones de cada usuario con sesión cada 15 min (por defecto `1500`) |
| `RATE_LIMIT_ANONYMOUS` | No | Peticiones sin sesión por IP cada 15 min (por defecto `1500`) |
| `RATE_LIMIT_AUTH` | No | Intentos fallidos de inicio de sesión por cuenta cada 15 min (por defecto `25`) |
| `RATE_LIMIT_AUTH_IP` | No | Intentos fallidos de autenticación por IP, sumando cuentas, cada 15 min (por defecto `500`) |
| `SLOW_QUERY_MS` | No | Registra las consultas SQL más lentas que este valor (por defecto `20`; `0` lo desactiva) |
| `WORKERS` | No | Procesos de la API: un número o `auto` (uno por núcleo). Por defecto `1`, sin cluster |
| `UV_THREADPOOL_SIZE` | No | Hilos para bcrypt, sharp y disco por proceso (por defecto, los núcleos repartidos entre los procesos, entre 4 y 16) |

Genera un secreto seguro con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ejemplo completo de `server/.env` para desarrollo:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://study_planner:study_planner_dev@localhost:5432/study_planner
JWT_SECRET=pega-aqui-el-secreto-generado-con-el-comando-anterior
SESSION_DAYS=7
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SAMESITE=lax
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
MAX_AVATAR_SIZE_MB=8
```

### Cliente (`client/.env`, opcional)

En desarrollo no hace falta: Vite reenvía `/api` y `/socket.io` al servidor. Solo si la API vive en
otro dominio:

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base de la API (por defecto `/api`) |
| `VITE_SOCKET_URL` | Origen del servidor Socket.IO (por defecto, el mismo de la página) |
| `VITE_DEV_API_TARGET` | Solo desarrollo: a dónde reenvía Vite (por defecto `http://localhost:4000`) |

---

## Ejecutar en desarrollo

Con `server/.env` creado, arranca PostgreSQL (y Redis y S3, aunque en desarrollo no hacen falta) y
después la app:

```bash
npm run services:up
```

```bash
npm run dev
```

Arranca la API en http://localhost:4000 y la web en http://localhost:5173. Abre la web y crea tu cuenta.

Para arrancarlos por separado, en dos terminales:

```bash
npm run dev --prefix server
```

```bash
npm run dev --prefix client
```

### Datos de demostración (opcional)

La aplicación arranca vacía y solo muestra datos reales. Si quieres probarla con contenido, hay un
seed **solo para desarrollo** que crea tres cuentas con el dominio `@demo.study-planner.local`
(tareas, notas, una sala con chat y sesiones de Pomodoro):

```bash
npm run seed
```

Las cuentas de demo usan la contraseña `demo12345` (puedes cambiarla con la variable
`SEED_PASSWORD`). Para borrar todo lo que creó el seed sin tocar el resto de datos:

```bash
npm run seed:clear
```

El seed se niega a ejecutarse con `NODE_ENV=production`.

---

## Producción

### 1. Compilar el frontend

```bash
npm run build
```

Genera `client/dist/`.

### 2a. Un único servicio (recomendado)

Express sirve la API y el frontend desde el mismo origen, así las cookies funcionan sin configuración
extra. En `server/.env`:

```
NODE_ENV=production
SERVE_CLIENT=true
CLIENT_ORIGIN=https://tu-dominio.com
TRUST_PROXY=1
```

y arranca:

```bash
npm start
```

### Varios procesos (aprovechar todos los núcleos)

Un proceso de Node usa un solo núcleo. Con `WORKERS` el servidor arranca un proceso principal que
reparte las conexiones entre varios procesos de la API sobre el mismo puerto y la misma base de datos:

```
WORKERS=auto
```

- `auto` arranca uno por núcleo; también puedes poner un número. Cada proceso ocupa unos 100–150 MB
  de memoria: en un servidor pequeño, elige un número que quepa.
- Si un proceso cae, el principal lo vuelve a arrancar solo. Los recordatorios de entregas corren en
  un único proceso.
- Socket.IO funciona solo con WebSocket. Si hay un proxy delante (nginx…), tiene que dejar pasar
  WebSocket (cabeceras `Upgrade` y `Connection`); los servicios gestionados (Render, Railway…) ya lo hacen.
- Con PM2, usa el modo `fork` con una sola instancia: el propio servidor crea y vigila sus procesos.
- `GET /api/health` indica qué proceso ha respondido (`process.index` de `process.of`).
- Sin Redis, los procesos se coordinan a través del principal y tienen que estar en la misma máquina.
  Para repartir entre varias, mira el apartado siguiente.

### Varias máquinas

Con `REDIS_URL` y `S3_BUCKET` puedes arrancar la API en tantos servidores como quieras detrás de un
balanceador, todos con el mismo `server/.env` (y cada uno con su `WORKERS`):

- **PostgreSQL** guarda los datos; todos los servidores usan la misma `DATABASE_URL`.
- **Redis** reparte los eventos de Socket.IO (un mensaje llega aunque el destinatario esté conectado a
  otro servidor), cuenta los límites de peticiones entre todos y avisa a los demás cuando hay que
  olvidar una caché.
- **S3** (AWS S3, Cloudflare R2, Backblaze B2…) guarda las fotos y los archivos. Las descargas de las
  salas van directas al almacenamiento con un enlace firmado de 60 segundos, que solo se genera tras
  comprobar que quien lo pide está en la sala.
- El balanceador tiene que dejar pasar WebSocket; no hacen falta sesiones *sticky*.
- Los recordatorios corren en cada servidor, pero cada tarea se reclama con `FOR UPDATE SKIP LOCKED`:
  nunca se avisa dos veces.
- Conexiones: cada proceso abre `DATABASE_POOL_SIZE` conexiones a PostgreSQL al arrancar. La suma de
  todos los procesos de todas las máquinas tiene que caber en el `max_connections` del servidor
  (100 por defecto); si no, baja el tamaño del grupo o pon PgBouncer delante.

### 2b. Frontend y API en dominios distintos

- Publica `client/dist/` en cualquier hosting estático, configurando la reescritura de rutas a `index.html`.
- Compila el cliente con `VITE_API_URL=https://api.tu-dominio.com/api` y `VITE_SOCKET_URL=https://api.tu-dominio.com`.
- En el servidor: `CLIENT_ORIGIN=https://tu-dominio.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (requiere HTTPS).

Sin S3, la carpeta `server/uploads` (los archivos) debe estar en un disco persistente (o en un
volumen) para que no se pierda entre despliegues; si usas otra ruta, indícala con `UPLOAD_DIR`.

### Monitorización

`GET /api/health` responde `200` si el servidor y la base de datos funcionan (`503` si la base falla)
e incluye el retraso del bucle de eventos (`eventLoopDelayMs`): cuánto espera una petición a que el
hilo de Node quede libre. Si su p99 pasa de unos 100 ms de forma sostenida, el servidor está cerca de
su límite. El servidor también avisa en el registro de las consultas SQL lentas (`SLOW_QUERY_MS`) y
de los minutos en que el bucle de eventos va saturado.

Los archivos de `client/dist/assets` llevan un hash en el nombre y se sirven con caché de un año;
`index.html` se revalida en cada visita, así que un despliegue nuevo llega a todo el mundo al recargar.

---

## Pruebas de carga

Para medir el rendimiento sin tocar los datos reales hay un generador de datos de carga y un script
que simula estudiantes usando la app (dashboard, tareas, notas, calendario, chat, búsquedas…).

```bash
docker compose exec postgres createdb -U study_planner study_planner_carga
```

```bash
cd server
DATABASE_URL=postgres://study_planner:study_planner_dev@localhost:5432/study_planner_carga npm run seed:load -- --users 2000
NODE_ENV=production PORT=4100 DATABASE_URL=postgres://study_planner:study_planner_dev@localhost:5432/study_planner_carga npm start
```

Y en otra terminal, desde la raíz:

```bash
npm run load-test -- --users 300 --duration 60
```

`seed:load` crea cuentas `u0…uN@carga.study-planner.local` (contraseña `carga12345`) con 40 tareas,
notas, amigos, salas con 200 mensajes y sesiones de Pomodoro, y solo se ejecuta contra bases cuyo
nombre contenga `carga`, `prueba`, `test` o `smoke`. Con `--url http://a:4100,http://b:4100` reparte los
usuarios entre varios servidores, como un balanceador. El script inicia sesión con todos los usuarios a la vez y después cada uno hace una acción cada
segundo de media (`--think` en ms). Muestra peticiones por segundo, latencias p50/p95/p99 por
endpoint, errores y el estado del bucle de eventos. `--sockets` abre además una conexión Socket.IO por
usuario. Todas las peticiones salen de tu IP: con más de 500 usuarios virtuales, sube
`RATE_LIMIT_AUTH_IP` (y con más de 1500, `RATE_LIMIT_ANONYMOUS`) en la API de pruebas para que los
inicios de sesión simultáneos no choquen con los límites por IP. Al terminar, para la API y borra la
base (`docker compose exec postgres dropdb -U study_planner study_planner_carga`).

Resultados de referencia en un portátil con la versión SQLite (fases 1 a 3; un proceso de Node,
2000 cuentas, 300 usuarios):

| Medición | Al principio | Tras la fase 1 | Ahora (fase 2) |
|----------|--------------|----------------|----------------|
| 300 inicios de sesión a la vez | hasta 60 s (y 275 de 300 rechazados por el límite por IP) | 5 s, sin errores | 5 s, sin errores |
| Uso normal (≈ 300 peticiones/s): p50 / p95 / p99 del dashboard | 19 / 148 / 328 ms | 12 / 33 / 47 ms | 9 / 27 / 46 ms |
| 300 usuarios con pausas de 0,3 s | saturado: 481 peticiones/s, p50 ≈ 340 ms | saturado: 814 peticiones/s, p50 ≈ 100 ms | sin saturar: 1015 peticiones/s, p50 15 ms |
| Máximo sostenido (600 usuarios con pausas de 0,1 s) | — | — | ≈ 1570 peticiones/s, sin errores |
| Mayor bloqueo del servidor | 4,8 s (inicios de sesión) | 0,19 s | 0,2 s |

Qué se ha cambiado en cada mejora: sección 9 de `docs/ARCHITECTURE.md`.

Con varios procesos (`WORKERS`, fase 3), 800 usuarios con pausas de 0,1 s:

| Procesos de la API | Peticiones/s | p50 del dashboard | Errores |
|--------------------|--------------|-------------------|---------|
| 1 | 1.299 | 623 ms | 0 |
| 4 | 2.190 | 268 ms | 0 |
| 8 | 2.684 | 210 ms | 0 |

Con 8 procesos el límite lo pone el propio script de carga (un solo proceso de Node que ya va al
máximo) y no el servidor, cuyos procesos estaban al 75–80 % de CPU: la capacidad real es mayor. Para
medirla, lanza el script desde otra máquina o varias copias a la vez.

Con PostgreSQL (fase 4), en el mismo portátil y con PostgreSQL y Redis en Docker:

| Configuración | Carga | Peticiones/s | p50 del dashboard | Errores |
|---------------|-------|--------------|-------------------|---------|
| 1 proceso | 300 usuarios, pausas de 0,3 s | 576 | 267 ms | 0 |
| 4 procesos, sin Redis | 300 usuarios, pausas de 0,3 s | 888 | 57 ms | 0 |
| 4 procesos, con Redis | 300 usuarios, pausas de 0,3 s | 874 | 62 ms | 0 |
| 2 servidores × 4 procesos, con Redis y S3 | 800 usuarios, pausas de 0,1 s | 917 | 595–1.128 ms | 0 |

Un proceso rinde menos que con SQLite: cada consulta es un viaje de red a PostgreSQL (unos 0,8 ms con
Docker en Windows) en lugar de una llamada dentro del propio proceso. Redis apenas cuesta (un 2 %).
La última fila no mide la capacidad de dos máquinas: los dos servidores, los dos generadores de carga,
PostgreSQL y Redis comparten los mismos 16 núcleos. Lo que demuestra es que dos servidores trabajan
juntos sin errores; la ganancia de capacidad se mide con servidores en máquinas distintas.

---

## Seguridad

- Contraseñas con bcrypt nativo (coste 12), calculado fuera del hilo principal, y comparación de tiempo constante en el login.
- Sesión en cookie `httpOnly`, `SameSite` y `Secure` en producción; cambiar la contraseña revoca las demás sesiones.
- Validación de todas las entradas con zod en el servidor; solo los campos validados llegan a la lógica.
- Permisos comprobados en cada operación (propietario de la tarea, participante o administrador de la sala).
- CORS restringido, comprobación de `Origin` en peticiones que modifican datos y Helmet.
- Límites de peticiones por usuario (no por IP, para no bloquear a quienes comparten la red de una
  universidad) e intentos de inicio de sesión limitados por cuenta y por IP.
- Fotos de perfil procesadas en el servidor con sharp: recorte cuadrado de 256 px, WebP de unos pocos KB
  y sin metadatos (EXIF, ubicación GPS). La imagen original no se guarda.
- Archivos fuera de cualquier carpeta pública, con nombre aleatorio, tipos permitidos, tamaño máximo,
  verificación de la firma binaria y descarga solo para participantes de la sala.
- Ningún secreto en el código: todo se configura con variables de entorno.

---

## Scripts

| Comando (desde la raíz) | Qué hace |
|-------------------------|----------|
| `npm run install:all` | Instala dependencias de servidor y cliente |
| `npm run dev` | API y web en modo desarrollo |
| `npm run build` | Compila el frontend |
| `npm start` | Arranca la API en producción |
| `npm run seed` / `npm run seed:clear` | Crea o borra los datos de demostración |
| `npm run services:up` / `npm run services:down` | Arranca o para PostgreSQL, Redis y S3 de desarrollo (Docker) |
| `npm run db:import-sqlite` | Pasa una base SQLite de la versión anterior a PostgreSQL |
| `npm run seed:load` | Genera datos para pruebas de carga (solo contra una base de pruebas) |
| `npm run load-test` | Lanza la prueba de carga contra una API de pruebas |

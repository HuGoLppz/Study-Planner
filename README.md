# Study Planner

Plataforma de organización académica y colaboración entre estudiantes. Reúne en un solo sitio
tareas, asignaturas, calendario, notas y estadísticas, amigos, salas de estudio con chat en tiempo
real y archivos compartidos, notificaciones y un temporizador Pomodoro.

- **Frontend**: React 19 + Vite + React Router (`client/`)
- **Backend**: Node.js + Express 5 + Socket.IO (`server/`)
- **Base de datos**: MongoDB con Mongoose (no relacional, sin SQL en ningún punto)

El análisis previo, el modelo documental, los índices, la API completa, la navegación y el sistema
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

**Servidor**: Express 5, Mongoose 8, Socket.IO, bcryptjs, JSON Web Tokens en cookie `httpOnly`,
Zod (validación), Multer (subidas), Helmet, CORS y express-rate-limit.

---

## Estructura del proyecto

```
Study-Planner/
├── package.json            scripts para ejecutar todo desde la raíz
├── scripts/dev.mjs         arranca API y web a la vez
├── docs/ARCHITECTURE.md    análisis, modelo de datos, índices, API, navegación y diseño
├── server/
│   ├── .env.example
│   ├── uploads/            archivos subidos (fuera de git)
│   └── src/
│       ├── server.js       arranque (BD, HTTP, Socket.IO, recordatorios)
│       ├── app.js          Express: seguridad, rutas y errores
│       ├── config/         variables de entorno y constantes
│       ├── database/       conexión a MongoDB
│       ├── models/         User, Task, Friendship, Room, Message, RoomFile, Notification, PomodoroDay
│       ├── auth/           contraseñas, tokens, cookies y sesión
│       ├── middleware/     autenticación, validación, acceso a salas, seguridad, errores
│       ├── validators/     esquemas zod por recurso
│       ├── routes/         un router por recurso
│       ├── controllers/    adaptadores HTTP
│       ├── services/       lógica de negocio
│       ├── serializers/    datos públicos de cada usuario
│       ├── uploads/        multer, tipos permitidos y firmas binarias
│       ├── sockets/        Socket.IO y emisores
│       ├── jobs/           recordatorios de entregas
│       ├── utils/          utilidades
│       └── seed/           datos de demostración (solo desarrollo)
└── client/
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx, router.jsx
        ├── styles/         tokens de diseño y estilos base
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
- **MongoDB 6 o superior**, local o en MongoDB Atlas

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

## Configuración de MongoDB

### MongoDB local

1. Instala MongoDB Community Server desde https://www.mongodb.com/try/download/community
   (en Windows puedes dejarlo instalado como servicio; en macOS `brew install mongodb-community`;
   en Linux sigue la guía de tu distribución). También vale Docker:

   ```bash
   docker run -d --name study-planner-mongo -p 27017:27017 mongo:7
   ```

2. Comprueba que escucha en `127.0.0.1:27017`.
3. En `server/.env` usa:

   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/study-planner
   ```

   La base de datos y sus índices se crean solos la primera vez que arranca el servidor.

### MongoDB Atlas

1. Crea un cluster (el nivel gratuito sirve) en https://cloud.mongodb.com.
2. En **Database Access**, crea un usuario con permisos de lectura y escritura.
3. En **Network Access**, añade la IP desde la que se conectará el servidor (o `0.0.0.0/0` solo para pruebas).
4. En **Connect → Drivers**, copia la cadena de conexión y añade el nombre de la base de datos:

   ```
   MONGODB_URI=mongodb+srv://<usuario>:<contraseña>@<cluster>.mongodb.net/study-planner?retryWrites=true&w=majority
   ```

   Si la contraseña tiene caracteres especiales (`@`, `:`, `/`…), codifícalos en formato URL.

---

## Variables de entorno

### Servidor (`server/.env`)

Copia el ejemplo y rellénalo:

```bash
cp server/.env.example server/.env
```

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `MONGODB_URI` | Sí | Cadena de conexión a MongoDB |
| `JWT_SECRET` | Sí | Secreto para firmar sesiones; mínimo 32 caracteres aleatorios |
| `NODE_ENV` | No | `development` o `production` |
| `PORT` | No | Puerto de la API (por defecto `4000`) |
| `SESSION_DAYS` | No | Duración de la sesión en días (por defecto `7`) |
| `CLIENT_ORIGIN` | No | Orígenes permitidos por CORS, separados por comas |
| `COOKIE_SAMESITE` | No | `lax` (por defecto), `strict` o `none` |
| `COOKIE_SECURE` | No | `true` para exigir HTTPS (por defecto, solo en producción) |
| `TRUST_PROXY` | No | Número de proxies delante del servidor |
| `UPLOAD_DIR` | No | Carpeta de archivos subidos (por defecto `uploads`) |
| `MAX_FILE_SIZE_MB` | No | Tamaño máximo de archivo de sala (por defecto `10`) |
| `MAX_AVATAR_SIZE_MB` | No | Tamaño máximo de la foto de perfil que se sube (por defecto `8`); se guarda optimizada |
| `SERVE_CLIENT` | No | `true` para que Express sirva el frontend compilado |
| `CLIENT_DIST` | No | Ruta al frontend compilado (por defecto `../client/dist`) |

Genera un secreto seguro con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ejemplo completo de `server/.env` para desarrollo:

```
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/study-planner
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

Con MongoDB en marcha y `server/.env` creado:

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

### 2b. Frontend y API en dominios distintos

- Publica `client/dist/` en cualquier hosting estático, configurando la reescritura de rutas a `index.html`.
- Compila el cliente con `VITE_API_URL=https://api.tu-dominio.com/api` y `VITE_SOCKET_URL=https://api.tu-dominio.com`.
- En el servidor: `CLIENT_ORIGIN=https://tu-dominio.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (requiere HTTPS).

La carpeta `server/uploads` debe estar en un disco persistente (o en un volumen) para que los
archivos subidos no se pierdan entre despliegues.

---

## Seguridad

- Contraseñas con bcrypt (coste 12) y comparación de tiempo constante en el login.
- Sesión en cookie `httpOnly`, `SameSite` y `Secure` en producción; cambiar la contraseña revoca las demás sesiones.
- Validación de todas las entradas con zod en el servidor; solo los campos validados llegan a la lógica.
- Permisos comprobados en cada operación (propietario de la tarea, participante o administrador de la sala).
- CORS restringido, comprobación de `Origin` en peticiones que modifican datos, Helmet y límites de peticiones.
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

# AGENTS.md

Guía para agentes de código que trabajen en este repositorio. Complementa a
[README.md](README.md) (instalación y despliegue) y a [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(modelo de datos, índices, API y sistema visual). Si cambias algo que esos documentos describen,
actualízalos en el mismo cambio.

## El proyecto

Study Planner: organización académica y colaboración entre estudiantes. Monorepo con dos paquetes
independientes y sin workspaces:

- `server/`: API REST + Socket.IO. Node ≥ 20.19, ESM, Express 5, Mongoose 8, zod 3.
- `client/`: SPA. React 19, Vite 7, React Router 7, TanStack Query 5, Zustand, CSS Modules.
- Base de datos: **solo MongoDB**. No introduzcas SQL ni bases relacionales bajo ningún concepto.

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

No hay suite de tests ni linter configurados. La verificación mínima de cualquier cambio es:

1. `npm run build` sin errores (compila todo el cliente).
2. Arrancar la API y ejercitar los endpoints afectados (ver "Probar sin ensuciar datos").
3. Para cambios visuales, revisar la página en escritorio (≥ 1100 px), tablet (768–1099 px) y móvil (< 768 px).

## Configuración

- `server/.env` es obligatorio (copia `server/.env.example`). Sin `MONGODB_URI` o con un `JWT_SECRET`
  de menos de 32 caracteres el servidor no arranca: `config/env.js` valida al iniciar.
- Nunca escribas secretos en el código ni los subas al repositorio. `.env*` está en `.gitignore`
  salvo los `.env.example`.
- En desarrollo el cliente no necesita `.env`: Vite reenvía `/api` y `/socket.io` a
  `VITE_DEV_API_TARGET` (por defecto `http://localhost:4000`).

## Probar sin ensuciar datos

La aplicación **no debe mostrar nunca datos inventados**: la base real (`study-planner`) solo contiene
lo que crean los usuarios. Para probar:

```bash
cd server
PORT=4100 MONGODB_URI=mongodb://127.0.0.1:27017/study-planner-smoke npm run dev
MONGODB_URI=mongodb://127.0.0.1:27017/study-planner-smoke npm run seed
```

```bash
cd client
VITE_DEV_API_TARGET=http://localhost:4100 npm run dev
```

Al terminar, borra la base `study-planner-smoke`. En la misma instancia de MongoDB puede haber bases
de otros proyectos: no las toques. Las peticiones que modifican datos deben llevar un `Origin`
permitido (`http://localhost:5173`); si llamas a la API con `fetch`/`curl`, añádelo.

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
- **services/**: toda la lógica y el único sitio que usa los modelos.
- **serializers/**: qué se expone de un usuario. Para incrustar usuarios en otras respuestas usa
  `USER_SUMMARY_FIELDS` (`config/constants.js`) en el `populate` y `serializeUserSummary`. Nunca
  devuelvas `passwordHash`, `tokenVersion` ni `searchTokens`.

### Convenciones

- Express 5 propaga solos los errores de funciones `async`: no envuelvas handlers en `try/catch`
  ni uses `asyncHandler`.
- Errores de dominio con `ApiError` (`utils/ApiError.js`): `badRequest`, `unauthorized`,
  `forbidden`, `notFound`, `conflict`, `unprocessable(message, fields)`. La respuesta siempre tiene
  la forma `{ error: { message, code, fields? } }`; el cliente asigna `fields` a los campos del formulario.
- Códigos HTTP: 201 al crear, 204 sin cuerpo al borrar, 409 para conflictos de estado, 422 para
  validación, 404 cuando el recurso no existe **o no es del usuario** (no reveles su existencia).
- Las respuestas usan `_id` (no `id`). `toJSON` global quita `__v`.
- Valores de dominio y límites (tipos de tarea, colores, máximos por sala…) viven en
  `config/constants.js`. No los repitas en modelos, validadores ni servicios.
- `aggregate()` **no** convierte strings a ObjectId: usa `toObjectId` de `utils/ids.js` en los `$match`.

### Modelo documental

Antes de añadir una colección, revisa la sección 4 de `docs/ARCHITECTURE.md`. Reglas que el código asume:

- Asignaturas embebidas en `users.subjects`; la tarea guarda solo el `_id`. Comprueba siempre que la
  asignatura pertenece al usuario (`assertOwnSubject`).
- La nota va embebida en la tarea (`tasks.grade`) y solo existe si la tarea está completada.
- "Atrasada" se calcula (`status != completed && dueDate < ahora`); no se guarda.
- Participantes, invitaciones y tareas de sala van embebidos en `rooms` y tienen límites.
- Amistades: un documento por pareja con `pairKey` único.
- Pomodoro: un documento por usuario y día (`pomodorodays`), escrito con `upsert` + `$push` + `$inc`.
- MongoDB local suele ser standalone, sin transacciones: diseña cada operación para que sea **una
  escritura atómica sobre un solo documento**. En salas usa `updateOne`/`findOneAndUpdate` con
  operador posicional (`tasks.$`, `members.$`) o `arrayFilters` y condiciones en el filtro (ver
  `HAS_SPARE_ADMIN`); no hagas `room.save()` modificando arrays.
- Si una consulta nueva va a ser frecuente, añade su índice en el esquema y documéntalo en la tabla de
  índices de `ARCHITECTURE.md`.

### Tiempo real y avisos

- Las escrituras van **siempre por REST**; Socket.IO solo difunde. Emite únicamente a través de
  `sockets/emitter.js` (`emitToRoom`, `emitToUser`…).
- Tras cualquier cambio en una sala, termina con `broadcastRoom(roomId)` (`room.service.js`), que
  devuelve el detalle y lo emite como `room:updated`.
- Los avisos se crean con `notify()` (`notification.service.js`), que nunca lanza: un aviso fallido
  no debe romper la operación que lo origina. Guarda en `data` una instantánea (nombres, títulos) para
  pintarlo sin joins.

### Archivos

- Los tipos permitidos están en `uploads/fileTypes.js` (extensión → tipo MIME → firma binaria).
  Añadir un formato es añadir una fila ahí y, en el cliente, en `ACCEPTED_FILES` (`hooks/useRoomFiles.js`).
- Los archivos se guardan con nombre aleatorio fuera de cualquier carpeta pública y solo se sirven por
  rutas autenticadas que comprueban la pertenencia a la sala (`loadRoom` va **antes** de multer).
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
| `components/ui/` | Primitivas compartidas: `Button`, `Field`/`Input`/`Select`, `Modal`/`Drawer`/`OverlayFooter`, `EmptyState`, `ErrorState`, `Skeleton`, `Tabs`/`Segmented`, `Menu`, `Avatar`, `SubjectTag`, `Page`/`PageHeader`/`Section` |
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
- Cada lista o vista con datos tiene tres estados: carga (`Skeleton`/`SkeletonList`), error
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
- **Especificidad CSS**: los CSS Modules se cargan en orden imprevisible. Para sobrescribir un estilo
  de otro módulo usa un selector más específico (`.padre .hijo`, clase doble), no confíes en el orden.
- **Gráficas** (`components/charts/`): marcas finas, rejilla de línea continua, colores
  `--chart-accent`, `--chart-muted` y `--chart-alert` (ya validados para daltonismo y contraste), el
  texto nunca en el color de la serie, leyenda cuando hay dos series o más, y siempre una tabla o
  cifras visibles como alternativa al tooltip.
- **Movimiento**: solo como respuesta a una acción del usuario; respeta `prefers-reduced-motion`
  (ya cubierto en `base.css`).

## Seguridad

- Contraseñas con bcrypt (`auth/password.js`); sesión JWT en cookie `httpOnly` con `tokenVersion`
  (cambiar la contraseña invalida las demás sesiones).
- Cada consulta de datos de usuario filtra por propietario o por pertenencia a la sala (`loadRoom`).
  No confíes en ids que lleguen del cliente sin esa comprobación.
- `verifyOrigin`, CORS, Helmet y los limitadores de `middleware/security.js` se aplican a toda la
  API; no los desactives para depurar.
- Respeta siempre la privacidad del perfil (`privacy.profileVisibility`, `searchable`, `showGrades`)
  al exponer datos de otros usuarios (`user.service.js#getProfile`, `searchUsers`).

## Añadir un recurso nuevo (lista de pasos)

1. Valores y límites en `server/src/config/constants.js`.
2. Modelo e índices en `server/src/models/` (y exportarlo en `models/index.js`), tras decidir si va embebido.
3. Esquemas en `server/src/validators/`.
4. Servicio → controlador → router; montar el router en `routes/index.js`.
5. Cliente: `services/resources/<recurso>.api.js` y exportarlo en `services/api.js`.
6. Claves en `hooks/queryKeys.js` y hooks de consulta y mutación.
7. Página lazy en `router.jsx` y, si es una sección principal, entrada en `layouts/navigation.js`.
8. Actualizar `docs/ARCHITECTURE.md` (modelo, índices, tabla de API) y el README si cambian comandos o variables.

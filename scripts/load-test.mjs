// Prueba de carga de la API con usuarios virtuales que se comportan como estudiantes reales.
// Necesita una API de pruebas con los datos de `npm run seed:load` (ver README, "Pruebas de carga").
//
//   node scripts/load-test.mjs --url http://localhost:4100 --users 300 --duration 60
//
// Opciones:
//   --url        origen de la API (por defecto http://localhost:4100); varios separados por comas
//                (varias máquinas) y los usuarios se reparten entre ellos, como haría un balanceador
//   --users      usuarios virtuales simultáneos (300)
//   --accounts   cuentas creadas por seed:load (2000)
//   --duration   segundos de prueba tras iniciar sesión (60)
//   --think      pausa media entre acciones de cada usuario, en ms (1000)
//   --sockets    abre también una conexión Socket.IO por usuario y entra en su sala
//   --origin     cabecera Origin permitida por la API (http://localhost:5173)
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value === undefined || value.startsWith('--') ? true : typeof fallback === 'number' ? Number(value) : value;
};

// Varias URL separadas por comas (varias máquinas): los usuarios se reparten entre ellas.
const URLS = String(option('url', 'http://localhost:4100'))
  .split(',')
  .map((url) => url.trim());
const USERS = option('users', 300);
const ACCOUNTS = option('accounts', 2000);
const DURATION_S = option('duration', 60);
const THINK_MS = option('think', 1000);
const SOCKETS = option('sockets', false) === true;
const ORIGIN = option('origin', 'http://localhost:5173');
const PASSWORD = process.env.LOAD_PASSWORD ?? 'carga12345';
const DOMAIN = '@carga.study-planner.local';

// ---------------------------------------------------------------- medición

const stats = new Map();
function record(label, ms, status) {
  let entry = stats.get(label);
  if (!entry) {
    entry = { times: [], statuses: new Map() };
    stats.set(label, entry);
  }
  entry.times.push(ms);
  entry.statuses.set(status, (entry.statuses.get(status) ?? 0) + 1);
}

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (ms) => ms * (0.5 + Math.random());

async function call(session, label, method, path, body) {
  const API = `${session.base}/api`;
  const headers = { Origin: ORIGIN };
  if (session.cookie) headers.Cookie = session.cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const start = performance.now();
  let status = 0;
  let data = null;
  try {
    const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    status = response.status;
    const cookie = response.headers.get('set-cookie');
    if (cookie) session.cookie = cookie.split(';')[0];
    data = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.arrayBuffer();
  } catch {
    status = 'red';
  }
  record(label, performance.now() - start, status);
  return { status, data };
}

// ---------------------------------------------------------------- comportamiento

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const ACTIONS = [
  [25, 'dashboard', async (s) => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 14 * 86400000);
    await call(s, 'GET /dashboard', 'GET', `/dashboard?from=${from.toISOString()}&to=${to.toISOString()}&day=${dayKey(from)}&tz=Europe/Madrid`);
  }],
  [18, 'tareas', (s) => call(s, 'GET /tasks', 'GET', '/tasks?status=pending&sort=due&limit=50')],
  [8, 'avisos', (s) => call(s, 'GET /notifications/unread-count', 'GET', '/notifications/unread-count')],
  [10, 'leer chat', async (s) => {
    if (!s.roomId) return;
    await call(s, 'GET /rooms/:id/messages', 'GET', `/rooms/${s.roomId}/messages?limit=40`);
  }],
  [7, 'escribir en el chat', async (s) => {
    if (!s.roomId) return;
    await call(s, 'POST /rooms/:id/messages', 'POST', `/rooms/${s.roomId}/messages`, { body: 'Mensaje de la prueba de carga' });
  }],
  [5, 'salas', (s) => call(s, 'GET /rooms', 'GET', '/rooms')],
  [7, 'crear y completar tarea', async (s) => {
    const due = new Date(Date.now() + 3 * 86400000).toISOString();
    const { status, data } = await call(s, 'POST /tasks', 'POST', '/tasks', { title: 'Tarea de carga', dueDate: due, priority: 'medium' });
    if (status === 201) {
      await call(s, 'POST /tasks/:id/complete', 'POST', `/tasks/${data.task._id}/complete`, { score: Math.round(Math.random() * 100) / 10 });
    }
  }],
  [6, 'notas', (s) => call(s, 'GET /grades/stats', 'GET', '/grades/stats?tz=Europe/Madrid')],
  [5, 'calendario', async (s) => {
    const from = new Date();
    from.setDate(1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 7);
    await call(s, 'GET /tasks (rango)', 'GET', `/tasks?status=all&from=${from.toISOString()}&to=${to.toISOString()}&limit=200`);
    await call(s, 'GET /rooms/agenda', 'GET', `/rooms/agenda?from=${from.toISOString()}&to=${to.toISOString()}`);
  }],
  [5, 'buscar personas', (s) => call(s, 'GET /users/search', 'GET', `/users/search?q=${encodeURIComponent(['ana', 'garcia', 'luis mar', 'carga 1'][Math.floor(Math.random() * 4)])}`)],
  [4, 'amigos', (s) => call(s, 'GET /friends', 'GET', '/friends')],
];
const TOTAL_WEIGHT = ACTIONS.reduce((sum, [weight]) => sum + weight, 0);

function pickAction() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const action of ACTIONS) {
    roll -= action[0];
    if (roll <= 0) return action[2];
  }
  return ACTIONS[0][2];
}

let ioClient = null;
async function openSocket(session) {
  if (!ioClient) {
    const require = createRequire(new URL('../client/package.json', import.meta.url));
    ioClient = require('socket.io-client').io;
  }
  const socket = ioClient(session.base, { transports: ['websocket'], extraHeaders: { Cookie: session.cookie, Origin: ORIGIN }, reconnection: false });
  await new Promise((resolve) => {
    const start = performance.now();
    socket.once('connect', () => {
      record('socket connect', performance.now() - start, 'ok');
      resolve();
    });
    socket.once('connect_error', () => {
      record('socket connect', performance.now() - start, 'error');
      resolve();
    });
  });
  if (socket.connected && session.roomId) socket.emit('room:join', session.roomId, () => {});
  socket.on('message:new', () => {
    session.received += 1;
  });
  return socket;
}

// ---------------------------------------------------------------- ejecución

async function startUser(index) {
  const session = { base: URLS[index % URLS.length], cookie: null, roomId: null, received: 0 };
  const account = index % ACCOUNTS;
  const login = await call(session, 'POST /auth/login', 'POST', '/auth/login', { email: `u${account}${DOMAIN}`, password: PASSWORD });
  if (login.status !== 200) return null;
  const rooms = await call(session, 'GET /rooms', 'GET', '/rooms');
  session.roomId = rooms.data?.items?.[0]?._id ?? null;
  if (SOCKETS) session.socket = await openSocket(session);
  return session;
}

async function runUser(session, until) {
  await sleep(Math.random() * THINK_MS);
  while (Date.now() < until) {
    await pickAction()(session);
    await sleep(jitter(THINK_MS));
  }
}

function report(title, elapsedS, labels) {
  console.log(`\n${title}`);
  console.log('endpoint'.padEnd(32), 'peticiones'.padStart(10), 'p50'.padStart(8), 'p95'.padStart(8), 'p99'.padStart(8), 'máx'.padStart(8), '  respuestas');
  let total = 0;
  let failures = 0;
  for (const label of labels) {
    const entry = stats.get(label);
    if (!entry) continue;
    const sorted = [...entry.times].sort((a, b) => a - b);
    total += sorted.length;
    for (const [status, count] of entry.statuses) {
      if (!(status === 'ok' || (typeof status === 'number' && status < 400))) failures += count;
    }
    const statuses = [...entry.statuses].map(([status, count]) => `${status}×${count}`).join(' ');
    const fmt = (value) => `${value.toFixed(0)} ms`.padStart(8);
    console.log(
      label.padEnd(32),
      String(sorted.length).padStart(10),
      fmt(percentile(sorted, 50)),
      fmt(percentile(sorted, 95)),
      fmt(percentile(sorted, 99)),
      fmt(sorted.at(-1)),
      ` ${statuses}`,
    );
  }
  console.log(`Total: ${total} peticiones en ${elapsedS.toFixed(1)} s (${(total / elapsedS).toFixed(0)}/s), ${failures} con error.`);
}

async function main() {
  for (const url of URLS) {
    const health = await fetch(`${url}/api/health`).catch(() => null);
    if (!health?.ok) {
      console.error(`No responde ${url}/api/health. Arranca antes la API de pruebas.`);
      process.exit(1);
    }
  }

  console.log(`Prueba de carga contra ${URLS.join(' y ')}: ${USERS} usuarios, ${DURATION_S} s, pausa media ${THINK_MS} ms${SOCKETS ? ', con sockets' : ''}.`);

  const loginStart = performance.now();
  const sessions = (await Promise.all(Array.from({ length: USERS }, (_, index) => startUser(index)))).filter(Boolean);
  const loginElapsed = (performance.now() - loginStart) / 1000;
  report('Inicio de sesión (todos a la vez)', loginElapsed, ['POST /auth/login', 'socket connect']);
  if (sessions.length === 0) {
    console.error('Ningún usuario ha podido iniciar sesión. ¿Has ejecutado seed:load contra esta base?');
    process.exit(1);
  }
  stats.clear();

  const start = performance.now();
  await Promise.all(sessions.map((session) => runUser(session, Date.now() + DURATION_S * 1000)));
  const elapsed = (performance.now() - start) / 1000;
  report(`Uso normal: ${sessions.length} usuarios activos`, elapsed, [...stats.keys()].sort());

  for (const url of URLS) {
    const delay = (await fetch(`${url}/api/health`).then((response) => response.json())).eventLoopDelayMs.current;
    console.log(`\nBucle de eventos de ${url} (minuto en curso): p50 ${delay.p50} ms, p99 ${delay.p99} ms, máx ${delay.max} ms.`);
  }
  if (SOCKETS) {
    const received = sessions.reduce((sum, session) => sum + session.received, 0);
    console.log(`Mensajes de chat recibidos por socket: ${received}.`);
    sessions.forEach((session) => session.socket?.close());
  }
}

main();

// Datos de demostración SOLO para desarrollo. Nunca se ejecuta automáticamente.
//   npm run seed        crea las cuentas de demo (correo @demo.study-planner.local)
//   npm run seed:clear  elimina todo lo creado por el seed
// Las cuentas de demo son reconocibles por su dominio y se borran sin tocar datos reales.
import mongoose from 'mongoose';
import { hashPassword } from '../auth/password.js';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../database/connect.js';
import { Friendship, Message, Notification, PomodoroDay, Room, RoomFile, Task, User } from '../models/index.js';
import { paths, removeDirectory } from '../uploads/storage.js';
import { logger } from '../utils/logger.js';

const DOMAIN = '@demo.study-planner.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'demo12345';
const DAY = 24 * 60 * 60 * 1000;

const at = (days, hour = 23, minute = 59) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

async function clear() {
  const users = await User.find({ email: { $regex: `${DOMAIN.replace(/\./g, '\\.')}$` } }).select('_id');
  const ids = users.map((user) => user._id);
  if (ids.length === 0) return 0;

  const rooms = await Room.find({ createdBy: { $in: ids } }).select('_id');
  const roomIds = rooms.map((room) => room._id);

  await Promise.all([
    Task.deleteMany({ owner: { $in: ids } }),
    Friendship.deleteMany({ users: { $in: ids } }),
    Message.deleteMany({ $or: [{ room: { $in: roomIds } }, { author: { $in: ids } }] }),
    RoomFile.deleteMany({ room: { $in: roomIds } }),
    Notification.deleteMany({ $or: [{ recipient: { $in: ids } }, { actor: { $in: ids } }, { room: { $in: roomIds } }] }),
    PomodoroDay.deleteMany({ user: { $in: ids } }),
    Room.deleteMany({ _id: { $in: roomIds } }),
    Room.updateMany({}, { $pull: { members: { user: { $in: ids } }, invitations: { user: { $in: ids } } } }),
  ]);
  await Promise.all(roomIds.map((roomId) => removeDirectory(paths.room(roomId))));
  await User.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

async function createUser(name, local, studies, course, bio, subjects = []) {
  return User.create({
    name,
    email: `${local}${DOMAIN}`,
    handle: `demo.${local}`,
    passwordHash: await hashPassword(PASSWORD),
    studies,
    course,
    bio,
    privacy: { profileVisibility: 'friends', searchable: true, showGrades: true },
    subjects,
  });
}

async function seed() {
  const lucia = await createUser(
    'Lucía Martín Demo',
    'lucia',
    'Grado en Ingeniería Informática',
    '2º',
    'Cuenta de demostración generada por el seed de desarrollo.',
    [
      { name: 'Estructuras de datos', color: 'pink', description: 'Árboles, grafos y tablas hash' },
      { name: 'Cálculo II', color: 'yellow', description: 'Integrales múltiples' },
      { name: 'Redes', color: 'blue', description: 'Modelo TCP/IP' },
      { name: 'Bases de datos', color: 'mint', description: 'Modelado documental y relacional' },
    ],
  );
  const marcos = await createUser('Marcos Ortega Demo', 'marcos', 'Grado en Ingeniería Informática', '2º', 'Cuenta de demostración.');
  const sara = await createUser('Sara Gil Demo', 'sara', 'Grado en Matemáticas', '3º', 'Cuenta de demostración.');

  const [eda, calc, redes, bd] = lucia.subjects.map((subject) => subject._id);
  const done = (days, score) => ({
    status: 'completed',
    completedAt: at(days, 18),
    ...(score !== undefined ? { grade: { score, gradedAt: at(days + 1, 12) } } : {}),
  });

  await Task.insertMany(
    [
      { title: 'Práctica 1: listas enlazadas', subject: eda, type: 'practice', priority: 'medium', dueDate: at(-40), ...done(-41, 7.5) },
      { title: 'Parcial de integrales dobles', subject: calc, type: 'exam', priority: 'high', dueDate: at(-33, 10), ...done(-33, 5.8) },
      { title: 'Informe de subredes', subject: redes, type: 'assignment', priority: 'medium', dueDate: at(-26), ...done(-27, 8.2) },
      { title: 'Modelo documental de la biblioteca', subject: bd, type: 'project', priority: 'high', dueDate: at(-19), ...done(-20, 9.1) },
      { title: 'Práctica 2: árboles AVL', subject: eda, type: 'practice', priority: 'high', dueDate: at(-12), ...done(-12, 6.9) },
      { title: 'Hoja de problemas 3', subject: calc, type: 'assignment', priority: 'low', dueDate: at(-6), ...done(-7, 7.2) },
      { title: 'Lectura: capítulo 5 de Kurose', subject: redes, type: 'reading', priority: 'low', dueDate: at(-3), ...done(-3) },
      { title: 'Cuestionario de normalización', subject: bd, type: 'assignment', priority: 'medium', dueDate: at(-2) },
      { title: 'Entregar práctica 3: grafos', subject: eda, type: 'practice', priority: 'high', dueDate: at(0, 23, 59), status: 'in_progress' },
      { title: 'Examen parcial de redes', subject: redes, type: 'exam', priority: 'high', dueDate: at(2, 9, 0) },
      { title: 'Resumen de series de potencias', subject: calc, type: 'reading', priority: 'low', dueDate: at(4) },
      { title: 'Exposición sobre índices', subject: bd, type: 'presentation', priority: 'medium', dueDate: at(6, 11, 30) },
      { title: 'Proyecto final: planificador de rutas', subject: eda, type: 'project', priority: 'high', dueDate: at(11) },
      { title: 'Examen final de cálculo', subject: calc, type: 'exam', priority: 'high', dueDate: at(13, 9, 0) },
    ].map((task) => ({ ...task, owner: lucia._id, description: '', reminderSentAt: at(-1) })),
  );

  const pair = (a, b) => ({
    pairKey: Friendship.pairKeyFor(a._id, b._id),
    users: [a._id, b._id],
    requester: a._id,
    recipient: b._id,
  });
  await Friendship.create([
    { ...pair(lucia, marcos), status: 'accepted', acceptedAt: at(-30, 12) },
    { ...pair(sara, lucia), status: 'pending' },
  ]);

  const room = await Room.create({
    name: 'Repaso de estructuras de datos',
    description: 'Preparamos juntos la práctica de grafos y el proyecto final.',
    subject: { name: 'Estructuras de datos', color: 'pink' },
    scheduledAt: at(3, 17, 0),
    createdBy: lucia._id,
    members: [
      { user: lucia._id, role: 'admin', joinedAt: at(-10, 10) },
      { user: marcos._id, role: 'member', joinedAt: at(-9, 10) },
    ],
    tasks: [
      { title: 'Implementar Dijkstra', assignee: marcos._id, createdBy: lucia._id, dueDate: at(1), status: 'in_progress' },
      { title: 'Escribir los casos de prueba', assignee: lucia._id, createdBy: marcos._id, dueDate: at(2), status: 'pending' },
      { title: 'Repartir el proyecto final', assignee: null, createdBy: lucia._id, dueDate: null, status: 'completed', completedAt: at(-2, 19) },
    ],
    stats: { messages: 3, files: 0 },
    lastActivityAt: at(0, 9, 15),
  });

  await Message.insertMany([
    { room: room._id, author: lucia._id, body: 'He subido el enunciado de la práctica al campus.', createdAt: at(-1, 18, 2) },
    { room: room._id, author: marcos._id, body: 'Perfecto. Me pongo con Dijkstra esta tarde.', createdAt: at(-1, 18, 10) },
    { room: room._id, author: lucia._id, body: 'Yo preparo los casos de prueba para mañana.', createdAt: at(0, 9, 15) },
  ]);

  await Notification.create({
    recipient: lucia._id,
    type: 'friend_request',
    actor: sara._id,
    data: { actorName: sara.name, actorHandle: sara.handle },
  });

  for (let offset = -6; offset <= 0; offset += 1) {
    const focus = [2, 0, 3, 4, 1, 2, 1][offset + 6];
    if (!focus) continue;
    const sessions = Array.from({ length: focus }, (_, index) => ({
      phase: 'focus',
      plannedSeconds: 1500,
      actualSeconds: 1500,
      completed: true,
      startedAt: at(offset, 16 + index, 0),
      endedAt: at(offset, 16 + index, 25),
      subject: eda,
    }));
    await PomodoroDay.create({
      user: lucia._id,
      day: dayKey(at(offset, 12)),
      sessions,
      totals: { focusSeconds: focus * 1500, breakSeconds: 0, completedFocus: focus },
    });
  }

  return [lucia, marcos, sara];
}

async function main() {
  if (env.isProduction) {
    logger.error('El seed de desarrollo no se ejecuta con NODE_ENV=production.');
    process.exit(1);
  }

  await connectDatabase();
  const removed = await clear();
  if (removed) logger.info(`Eliminadas ${removed} cuentas de demo anteriores y sus datos.`);

  if (!process.argv.includes('--clear')) {
    const users = await seed();
    logger.info(`Cuentas de demo creadas en "${mongoose.connection.name}" (contraseña: ${PASSWORD}):`);
    users.forEach((user) => logger.info(`  ${user.email}`));
  }
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error(error);
  await disconnectDatabase();
  process.exit(1);
});

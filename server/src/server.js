import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connect.js';
import { startReminderJob } from './jobs/reminders.js';
import { initSockets } from './sockets/index.js';
import { logger } from './utils/logger.js';

async function start() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);
  const stopReminders = startReminderJob();

  server.listen(env.port, () => {
    logger.info(`API escuchando en http://localhost:${env.port}/api (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} recibido, cerrando…`);
    stopReminders();
    io.close();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  logger.error('No se pudo arrancar el servidor:', error.message);
  process.exit(1);
});

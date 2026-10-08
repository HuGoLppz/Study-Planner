import { workerIndex } from "../cluster/role.js";
import { env } from "../config/env.js";
import { sql } from "../database/db.js";
import { eventLoopDelay } from "../utils/eventLoop.js";

// Estado del servidor para balanceadores y monitorización. No expone datos de usuarios.
export async function getHealth() {
  let database = "ok";
  try {
    await sql("SELECT 1").get();
  } catch {
    database = "error";
  }

  return {
    status: database === "ok" ? "ok" : "degraded",
    database,
    uptimeSeconds: Math.round(process.uptime()),
    process: { index: workerIndex, of: env.workers },
    eventLoopDelayMs: eventLoopDelay(),
  };
}

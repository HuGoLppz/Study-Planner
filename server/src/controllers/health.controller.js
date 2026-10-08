import { getHealth } from "../services/health.service.js";

export async function show(_req, res) {
  const health = await getHealth();
  res.set("Cache-Control", "no-store");
  res.status(health.status === "ok" ? 200 : 503).json(health);
}

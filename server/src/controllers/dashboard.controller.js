import { getDashboard } from '../services/dashboard.service.js';

export async function show(req, res) {
  const { from, to, day, tz } = req.valid.query;
  res.json({ dashboard: await getDashboard(req.user, { from, to, day, timeZone: tz }) });
}

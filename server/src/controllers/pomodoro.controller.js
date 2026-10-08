import * as pomodoroService from "../services/pomodoro.service.js";

export function getSettings(req, res) {
  res.json({ settings: pomodoroService.getSettings(req.user) });
}

export async function updateSettings(req, res) {
  res.json({
    settings: await pomodoroService.updateSettings(req.user, req.valid.body),
  });
}

export async function logSession(req, res) {
  const day = await pomodoroService.logSession(req.user, req.valid.body);
  res.status(201).json({ day });
}

export async function today(req, res) {
  res.json({
    day: await pomodoroService.getDay(req.user._id, req.valid.query.day),
  });
}

export async function history(req, res) {
  res.json({
    items: await pomodoroService.getHistory(req.user._id, req.valid.query),
  });
}

import * as gradeService from '../services/grade.service.js';

export async function list(req, res) {
  res.json({ items: await gradeService.listGradedTasks(req.user._id, req.valid.query) });
}

export async function stats(req, res) {
  res.json({ stats: await gradeService.computeAcademicStats(req.user, { timeZone: req.valid.query.tz }) });
}

export async function set(req, res) {
  const task = await gradeService.setGrade(req.user._id, req.valid.params.taskId, req.valid.body.score);
  res.json({ task });
}

export async function remove(req, res) {
  const task = await gradeService.removeGrade(req.user._id, req.valid.params.taskId);
  res.json({ task });
}

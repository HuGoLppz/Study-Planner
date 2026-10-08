import * as taskService from "../services/task.service.js";

export async function list(req, res) {
  res.json(await taskService.listTasks(req.user, req.valid.query));
}

export async function summary(req, res) {
  res.json({ summary: await taskService.summarizeTasks(req.user._id) });
}

export async function get(req, res) {
  res.json({
    task: await taskService.getTask(req.user._id, req.valid.params.taskId),
  });
}

export async function create(req, res) {
  const task = await taskService.createTask(req.user, req.valid.body);
  res.status(201).json({ task });
}

export async function update(req, res) {
  const task = await taskService.updateTask(
    req.user,
    req.valid.params.taskId,
    req.valid.body,
  );
  res.json({ task });
}

export async function complete(req, res) {
  const task = await taskService.completeTask(
    req.user,
    req.valid.params.taskId,
    req.valid.body,
  );
  res.json({ task });
}

export async function reopen(req, res) {
  const task = await taskService.reopenTask(req.user, req.valid.params.taskId);
  res.json({ task });
}

export async function remove(req, res) {
  await taskService.deleteTask(req.user._id, req.valid.params.taskId);
  res.status(204).end();
}

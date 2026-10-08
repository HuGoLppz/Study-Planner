import * as notificationService from "../services/notification.service.js";

export async function list(req, res) {
  res.json(
    await notificationService.listNotifications(req.user._id, req.valid.query),
  );
}

export async function unreadCount(req, res) {
  res.json({ count: await notificationService.countUnread(req.user._id) });
}

export async function update(req, res) {
  const notification = await notificationService.setRead(
    req.user._id,
    req.valid.params.notificationId,
    req.valid.body.read,
  );
  res.json({ notification });
}

export async function readAll(req, res) {
  res.json({ updated: await notificationService.markAllRead(req.user._id) });
}

export async function remove(req, res) {
  await notificationService.removeNotification(
    req.user._id,
    req.valid.params.notificationId,
  );
  res.status(204).end();
}

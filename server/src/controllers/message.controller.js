import * as messageService from "../services/message.service.js";

export async function list(req, res) {
  res.json(await messageService.listMessages(req.room._id, req.valid.query));
}

export async function create(req, res) {
  const message = await messageService.createMessage(
    req.room,
    req.user,
    req.valid.body.body,
  );
  res.status(201).json({ message });
}

export async function update(req, res) {
  const message = await messageService.updateMessage(
    req.room,
    req.user,
    req.valid.params.messageId,
    req.valid.body.body,
  );
  res.json({ message });
}

export async function remove(req, res) {
  await messageService.deleteMessage(
    req.room,
    req.user,
    req.membership,
    req.valid.params.messageId,
  );
  res.status(204).end();
}

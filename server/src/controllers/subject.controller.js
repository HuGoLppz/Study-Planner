import { serializeSubject } from "../serializers/user.serializer.js";
import * as subjectService from "../services/subject.service.js";

export function list(req, res) {
  res.json({ items: req.user.subjects.map(serializeSubject) });
}

export async function create(req, res) {
  const subject = await subjectService.createSubject(req.user, req.valid.body);
  res.status(201).json({ subject: serializeSubject(subject) });
}

export async function update(req, res) {
  const subject = await subjectService.updateSubject(
    req.user,
    req.valid.params.subjectId,
    req.valid.body,
  );
  res.json({ subject: serializeSubject(subject) });
}

export async function remove(req, res) {
  await subjectService.deleteSubject(req.user, req.valid.params.subjectId);
  res.status(204).end();
}

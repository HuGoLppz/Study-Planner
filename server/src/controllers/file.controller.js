import * as fileService from '../services/file.service.js';

export async function list(req, res) {
  res.json({ items: await fileService.listFiles(req.room._id) });
}

export async function checkQuota(req, _res, next) {
  await fileService.assertFileQuota(req.room);
  next();
}

export async function upload(req, res) {
  const file = await fileService.createFile(req.room, req.user, req.file);
  res.status(201).json({ file });
}

export async function download(req, res) {
  const { filePath, file } = await fileService.getDownload(req.room._id, req.valid.params.fileId);
  res.set('Cache-Control', 'private, no-store');
  res.download(filePath, file.originalName, { headers: { 'Content-Type': file.mimeType } });
}

export async function remove(req, res) {
  await fileService.deleteFile(req.room, req.user, req.membership, req.valid.params.fileId);
  res.status(204).end();
}

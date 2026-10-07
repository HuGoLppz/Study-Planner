import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { AVATAR_TYPES, ROOM_FILE_TYPES, describeExtensions, matchesSignature } from './fileTypes.js';

export const paths = {
  avatars: () => path.join(env.uploadDir, 'avatars'),
  room: (roomId) => path.join(env.uploadDir, 'rooms', String(roomId)),
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const randomName = (extension) => `${crypto.randomUUID()}${extension}`;

// Sin `destination`, el archivo se queda en memoria para procesarlo antes de guardar nada en disco.
function createUploader({ table, destination, maxBytes, field }) {
  const storage = destination
    ? multer.diskStorage({
        destination: (req, _file, cb) => cb(null, ensureDir(destination(req))),
        filename: (_req, file, cb) => cb(null, randomName(path.extname(file.originalname).toLowerCase())),
      })
    : multer.memoryStorage();

  const fileFilter = (_req, file, cb) => {
    const rule = table[path.extname(file.originalname).toLowerCase()];
    if (!rule || !rule.accept.includes(file.mimetype)) {
      return cb(
        new ApiError(415, `Tipo de archivo no admitido. Formatos válidos: ${describeExtensions(table)}.`, 'UNSUPPORTED_FILE_TYPE'),
      );
    }
    file.canonicalMime = rule.mime;
    file.signature = rule.signature;
    return cb(null, true);
  };

  // defParamCharset: los navegadores envían el nombre del archivo en UTF-8 (tildes, eñes).
  const upload = multer({
    storage,
    fileFilter,
    defParamCharset: 'utf8',
    limits: { fileSize: maxBytes, files: 1, fields: 5 },
  }).single(field);

  // Tras recibirlo, comprueba la firma binaria: la extensión y el tipo declarado se pueden falsificar.
  return (req, res, next) => {
    upload(req, res, async (error) => {
      if (error) return next(error);
      if (!req.file) return next(ApiError.badRequest('Adjunta un archivo', 'FILE_REQUIRED'));

      try {
        const header = req.file.buffer ? req.file.buffer.subarray(0, 16) : await readHeader(req.file.path);
        if (!matchesSignature(req.file.signature, header)) {
          if (req.file.path) await removeFile(req.file.path);
          return next(new ApiError(415, 'El contenido del archivo no coincide con su extensión.', 'FILE_SIGNATURE_MISMATCH'));
        }
        return next();
      } catch (readError) {
        return next(readError);
      }
    });
  };
}

async function readHeader(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    await handle.read(header, 0, 16, 0);
    return header;
  } finally {
    await handle.close();
  }
}

// La foto de perfil no se guarda tal cual: se procesa en memoria (ver uploads/images.js).
export const uploadAvatar = createUploader({
  table: AVATAR_TYPES,
  maxBytes: env.maxAvatarSizeBytes,
  field: 'avatar',
});

// Guarda la foto de perfil ya procesada y devuelve su nombre en disco.
export async function storeAvatar(buffer, extension) {
  const fileName = randomName(extension);
  await fsp.writeFile(path.join(ensureDir(paths.avatars()), fileName), buffer);
  return fileName;
}

export const uploadRoomFile = createUploader({
  table: ROOM_FILE_TYPES,
  destination: (req) => paths.room(req.room._id),
  maxBytes: env.maxFileSizeBytes,
  field: 'file',
});

export async function removeFile(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn(`No se pudo borrar ${filePath}`, error.message);
  }
}

export async function removeDirectory(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true });
}

export async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import {
  AVATAR_TYPES,
  ROOM_FILE_TYPES,
  describeExtensions,
  matchesSignature,
} from "./fileTypes.js";
import { keys, objectStore } from "./objectStore.js";

const randomName = (extension) => `${crypto.randomUUID()}${extension}`;

// Los archivos se reciben en memoria (como mucho MAX_FILE_SIZE_MB), se comprueban y solo entonces
// se guardan en el almacenamiento (disco o S3, ver objectStore.js). `afterCheck` decide qué hacer
// con el archivo ya validado.
function createUploader({ table, maxBytes, field, afterCheck }) {
  const fileFilter = (_req, file, cb) => {
    const rule = table[path.extname(file.originalname).toLowerCase()];
    if (!rule || !rule.accept.includes(file.mimetype)) {
      return cb(
        new ApiError(
          415,
          `Tipo de archivo no admitido. Formatos válidos: ${describeExtensions(table)}.`,
          "UNSUPPORTED_FILE_TYPE",
        ),
      );
    }
    file.canonicalMime = rule.mime;
    file.signature = rule.signature;
    return cb(null, true);
  };

  // defParamCharset: los navegadores envían el nombre del archivo en UTF-8 (tildes, eñes).
  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    defParamCharset: "utf8",
    limits: { fileSize: maxBytes, files: 1, fields: 5 },
  }).single(field);

  // Tras recibirlo, comprueba la firma binaria: la extensión y el tipo declarado se pueden falsificar.
  return (req, res, next) => {
    upload(req, res, async (error) => {
      if (error) return next(error);
      if (!req.file)
        return next(ApiError.badRequest("Adjunta un archivo", "FILE_REQUIRED"));
      if (
        !matchesSignature(req.file.signature, req.file.buffer.subarray(0, 16))
      ) {
        return next(
          new ApiError(
            415,
            "El contenido del archivo no coincide con su extensión.",
            "FILE_SIGNATURE_MISMATCH",
          ),
        );
      }
      try {
        await afterCheck?.(req);
        return next();
      } catch (storeError) {
        return next(storeError);
      }
    });
  };
}

// La foto de perfil no se guarda tal cual: se procesa en memoria (ver uploads/images.js).
export const uploadAvatar = createUploader({
  table: AVATAR_TYPES,
  maxBytes: env.maxAvatarSizeBytes,
  field: "avatar",
});

// Los archivos de sala se guardan con nombre aleatorio en rooms/<sala>/.
export const uploadRoomFile = createUploader({
  table: ROOM_FILE_TYPES,
  maxBytes: env.maxFileSizeBytes,
  field: "file",
  afterCheck: async (req) => {
    const storedName = randomName(
      path.extname(req.file.originalname).toLowerCase(),
    );
    await objectStore.put(
      keys.roomFile(req.room._id, storedName),
      req.file.buffer,
      req.file.canonicalMime,
      req.file.originalname,
    );
    req.file.filename = storedName;
    req.file.buffer = null; // ya está guardado: no retenerlo en memoria
  },
});

// Foto de perfil ya procesada: la guarda y devuelve su nombre.
export async function storeAvatar(buffer, extension, contentType) {
  const fileName = randomName(extension);
  await objectStore.put(keys.avatar(fileName), buffer, contentType);
  return fileName;
}

export const removeAvatarFile = (fileName) =>
  objectStore.remove(keys.avatar(fileName));
export const readAvatarFile = (fileName) =>
  objectStore.read(keys.avatar(fileName));

export const removeRoomFile = (roomId, storedName) =>
  objectStore.remove(keys.roomFile(roomId, storedName));
export const removeRoomFiles = (roomId) =>
  objectStore.removePrefix(keys.room(roomId));

// Descarga de un archivo de sala: enlace firmado (S3) o ruta en disco. null si ya no existe.
export async function roomFileDownload(
  roomId,
  storedName,
  { fileName, contentType },
) {
  const key = keys.roomFile(roomId, storedName);
  if (!(await objectStore.exists(key))) return null;
  const url = await objectStore.downloadLink(key, { fileName, contentType });
  return url ? { url } : { filePath: objectStore.localPath(key) };
}

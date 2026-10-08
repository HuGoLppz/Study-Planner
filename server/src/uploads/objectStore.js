import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Dónde viven los archivos (fotos de perfil y archivos de las salas). Dos implementaciones con la
// misma interfaz, por clave ("avatars/abc.webp", "rooms/<sala>/abc.pdf"):
//   * disco (por defecto): UPLOAD_DIR de este servidor. Sirve con una sola máquina.
//   * S3 (S3_BUCKET): AWS S3, Cloudflare R2, SeaweedFS, MinIO… Imprescindible con varias máquinas.
//
//   put(key, buffer, contentType, fileName?)   guarda (fileName: nombre al descargar)
//   read(key)                       Readable con el contenido o null si no existe
//   exists(key)
//   remove(key) / removePrefix(prefix)
//   downloadLink(key, { fileName, contentType })   URL firmada de 60 s (S3) o null (disco)
//   localPath(key)                  ruta en disco (solo disco)

const SIGNED_URL_SECONDS = 60;

// Content-Disposition con el nombre original (tildes incluidas) para la descarga.
export function attachmentHeader(fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function diskStore(root) {
  const resolve = (key) => {
    const target = path.resolve(root, key);
    if (!target.startsWith(path.resolve(root) + path.sep))
      throw new Error(`Clave de archivo no válida: ${key}`);
    return target;
  };
  return {
    kind: "disco",
    async put(key, buffer) {
      const target = resolve(key);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, buffer);
    },
    async read(key) {
      const target = resolve(key);
      return (await this.exists(key)) ? fs.createReadStream(target) : null;
    },
    async exists(key) {
      try {
        await fsp.access(resolve(key), fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },
    async remove(key) {
      try {
        await fsp.unlink(resolve(key));
      } catch (error) {
        if (error.code !== "ENOENT")
          logger.warn(`No se pudo borrar ${key}`, error.message);
      }
    },
    async removePrefix(prefix) {
      await fsp.rm(resolve(prefix), { recursive: true, force: true });
    },
    async downloadLink() {
      return null;
    },
    localPath: resolve,
    async init() {},
  };
}

function s3Store(config) {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const Bucket = config.bucket;
  const missing = (error) =>
    error?.name === "NoSuchKey" ||
    error?.name === "NotFound" ||
    error?.$metadata?.httpStatusCode === 404;

  return {
    kind: "s3",
    // El nombre de descarga se guarda también en el propio objeto: no todos los servicios compatibles
    // con S3 respetan el que pide el enlace firmado (SeaweedFS, por ejemplo).
    async put(key, buffer, contentType, fileName) {
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ContentDisposition: fileName ? attachmentHeader(fileName) : undefined,
        }),
      );
    },
    async read(key) {
      try {
        return (await client.send(new GetObjectCommand({ Bucket, Key: key })))
          .Body;
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch (error) {
        if (missing(error)) return false;
        throw error;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    async removePrefix(prefix) {
      let ContinuationToken;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket,
            Prefix: `${prefix}/`,
            ContinuationToken,
          }),
        );
        const objects = (page.Contents ?? []).map(({ Key }) => ({ Key }));
        if (objects.length)
          await client.send(
            new DeleteObjectsCommand({
              Bucket,
              Delete: { Objects: objects, Quiet: true },
            }),
          );
        ContinuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (ContinuationToken);
    },
    // El navegador descarga directamente del almacenamiento: el archivo no pasa por la API.
    async downloadLink(key, { fileName, contentType }) {
      const command = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentDisposition: attachmentHeader(fileName),
        ResponseContentType: contentType,
      });
      return getSignedUrl(client, command, { expiresIn: SIGNED_URL_SECONDS });
    },
    localPath() {
      throw new Error(
        "Con S3 los archivos no están en el disco de este servidor",
      );
    },
    // Solo en desarrollo (S3_CREATE_BUCKET=true): en producción el bucket ya existe.
    async init() {
      if (!config.createBucket) return;
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        if (!missing(error)) throw error;
        await client.send(new CreateBucketCommand({ Bucket }));
        logger.info(`Bucket ${Bucket} creado`);
      }
    },
  };
}

export const objectStore = env.s3 ? s3Store(env.s3) : diskStore(env.uploadDir);

export const keys = {
  avatar: (fileName) => `avatars/${path.basename(fileName)}`,
  roomFile: (roomId, storedName) =>
    `rooms/${roomId}/${path.basename(storedName)}`,
  room: (roomId) => `rooms/${roomId}`,
};

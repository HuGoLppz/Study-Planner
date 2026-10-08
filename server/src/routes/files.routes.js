import { Router } from "express";
import * as files from "../controllers/file.controller.js";
import { loadRoom } from "../middleware/roomAccess.js";
import { validate } from "../middleware/validate.js";
import { uploadRoomFile } from "../uploads/storage.js";
import { fileIdSchema, roomIdSchema } from "../validators/room.schemas.js";

export const filesRouter = Router({ mergeParams: true });

const member = loadRoom();

// La pertenencia a la sala se comprueba antes de aceptar ningún byte.
filesRouter.get("/", validate(roomIdSchema), member, files.list);
filesRouter.post(
  "/",
  validate(roomIdSchema),
  member,
  files.checkQuota,
  uploadRoomFile,
  files.upload,
);
filesRouter.get(
  "/:fileId/download",
  validate(fileIdSchema),
  member,
  files.download,
);
filesRouter.delete("/:fileId", validate(fileIdSchema), member, files.remove);

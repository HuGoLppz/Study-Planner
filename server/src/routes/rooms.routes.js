import { Router } from "express";
import * as rooms from "../controllers/room.controller.js";
import { loadRoom } from "../middleware/roomAccess.js";
import { validate } from "../middleware/validate.js";
import {
  agendaSchema,
  createRoomSchema,
  createRoomTaskSchema,
  inviteSchema,
  memberRoleSchema,
  roomIdSchema,
  roomTaskIdSchema,
  roomUserSchema,
  updateRoomSchema,
  updateRoomTaskSchema,
} from "../validators/room.schemas.js";
import { filesRouter } from "./files.routes.js";
import { messagesRouter } from "./messages.routes.js";

export const roomsRouter = Router();

const member = loadRoom();
const admin = loadRoom({ role: "admin" });

roomsRouter.get("/", rooms.list);
roomsRouter.post("/", validate(createRoomSchema), rooms.create);
roomsRouter.get("/invitations", rooms.invitations);
roomsRouter.get("/agenda", validate(agendaSchema), rooms.agenda);

roomsRouter.get("/:roomId", validate(roomIdSchema), member, rooms.get);
roomsRouter.patch("/:roomId", validate(updateRoomSchema), admin, rooms.update);
roomsRouter.delete("/:roomId", validate(roomIdSchema), admin, rooms.remove);

// Invitaciones: aceptar y rechazar las usa el invitado, que aún no es participante.
roomsRouter.post(
  "/:roomId/invitations",
  validate(inviteSchema),
  member,
  rooms.invite,
);
roomsRouter.post(
  "/:roomId/invitations/accept",
  validate(roomIdSchema),
  rooms.acceptInvitation,
);
roomsRouter.post(
  "/:roomId/invitations/decline",
  validate(roomIdSchema),
  rooms.declineInvitation,
);
roomsRouter.delete(
  "/:roomId/invitations/:userId",
  validate(roomUserSchema),
  admin,
  rooms.cancelInvitation,
);

roomsRouter.patch(
  "/:roomId/members/:userId",
  validate(memberRoleSchema),
  admin,
  rooms.updateMember,
);
roomsRouter.delete(
  "/:roomId/members/:userId",
  validate(roomUserSchema),
  member,
  rooms.removeMember,
);

roomsRouter.get(
  "/:roomId/tasks",
  validate(roomIdSchema),
  member,
  rooms.listTasks,
);
roomsRouter.post(
  "/:roomId/tasks",
  validate(createRoomTaskSchema),
  member,
  rooms.createTask,
);
roomsRouter.patch(
  "/:roomId/tasks/:taskId",
  validate(updateRoomTaskSchema),
  member,
  rooms.updateTask,
);
roomsRouter.delete(
  "/:roomId/tasks/:taskId",
  validate(roomTaskIdSchema),
  member,
  rooms.deleteTask,
);

roomsRouter.use("/:roomId/messages", messagesRouter);
roomsRouter.use("/:roomId/files", filesRouter);

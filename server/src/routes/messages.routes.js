import { Router } from "express";
import * as messages from "../controllers/message.controller.js";
import { loadRoom } from "../middleware/roomAccess.js";
import { validate } from "../middleware/validate.js";
import {
  createMessageSchema,
  listMessagesSchema,
  messageIdSchema,
  updateMessageSchema,
} from "../validators/room.schemas.js";

export const messagesRouter = Router({ mergeParams: true });

const member = loadRoom();

messagesRouter.get("/", validate(listMessagesSchema), member, messages.list);
messagesRouter.post(
  "/",
  validate(createMessageSchema),
  member,
  messages.create,
);
messagesRouter.patch(
  "/:messageId",
  validate(updateMessageSchema),
  member,
  messages.update,
);
messagesRouter.delete(
  "/:messageId",
  validate(messageIdSchema),
  member,
  messages.remove,
);

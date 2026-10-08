import { Router } from "express";
import * as friends from "../controllers/friend.controller.js";
import { validate } from "../middleware/validate.js";
import {
  friendIdSchema,
  requestIdSchema,
  sendRequestSchema,
} from "../validators/friend.schemas.js";

export const friendsRouter = Router();

friendsRouter.get("/", friends.list);
friendsRouter.get("/requests", friends.requests);
friendsRouter.post(
  "/requests",
  validate(sendRequestSchema),
  friends.sendRequest,
);
friendsRouter.post(
  "/requests/:requestId/accept",
  validate(requestIdSchema),
  friends.acceptRequest,
);
friendsRouter.delete(
  "/requests/:requestId",
  validate(requestIdSchema),
  friends.deleteRequest,
);
friendsRouter.delete("/:userId", validate(friendIdSchema), friends.remove);

import { Router } from "express";
import * as users from "../controllers/user.controller.js";
import { validate } from "../middleware/validate.js";
import { uploadAvatar } from "../uploads/storage.js";
import {
  profileByHandleSchema,
  searchUsersSchema,
  updatePreferencesSchema,
  updatePrivacySchema,
  updateProfileSchema,
  userIdParamsSchema,
} from "../validators/user.schemas.js";

export const usersRouter = Router();

usersRouter.get("/search", validate(searchUsersSchema), users.search);
usersRouter.get(
  "/handle/:handle",
  validate(profileByHandleSchema),
  users.profile,
);
usersRouter.patch("/me", validate(updateProfileSchema), users.updateMe);
usersRouter.patch(
  "/me/privacy",
  validate(updatePrivacySchema),
  users.updatePrivacy,
);
usersRouter.patch(
  "/me/preferences",
  validate(updatePreferencesSchema),
  users.updatePreferences,
);
usersRouter.put("/me/avatar", uploadAvatar, users.uploadAvatar);
usersRouter.delete("/me/avatar", users.deleteAvatar);
usersRouter.get("/:userId/avatar", validate(userIdParamsSchema), users.avatar);

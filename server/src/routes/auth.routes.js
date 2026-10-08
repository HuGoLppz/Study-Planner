import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  authIpLimiter,
  loginLimiter,
  passwordLimiter,
} from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "../validators/auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authIpLimiter,
  validate(registerSchema),
  auth.register,
);
authRouter.post(
  "/login",
  authIpLimiter,
  loginLimiter,
  validate(loginSchema),
  auth.login,
);
authRouter.post("/logout", auth.logout);
authRouter.get("/me", requireAuth, auth.me);
authRouter.patch(
  "/password",
  requireAuth,
  passwordLimiter,
  validate(changePasswordSchema),
  auth.changePassword,
);

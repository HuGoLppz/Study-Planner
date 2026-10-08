import { Router } from "express";
import * as dashboard from "../controllers/dashboard.controller.js";
import * as health from "../controllers/health.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { userLimiter } from "../middleware/security.js";
import { validate } from "../middleware/validate.js";
import { dashboardSchema } from "../validators/pomodoro.schemas.js";
import { authRouter } from "./auth.routes.js";
import { friendsRouter } from "./friends.routes.js";
import { gradesRouter } from "./grades.routes.js";
import { notificationsRouter } from "./notifications.routes.js";
import { pomodoroRouter } from "./pomodoro.routes.js";
import { roomsRouter } from "./rooms.routes.js";
import { subjectsRouter } from "./subjects.routes.js";
import { tasksRouter } from "./tasks.routes.js";
import { usersRouter } from "./users.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", health.show);

apiRouter.use("/auth", authRouter);

// A partir de aquí todo requiere sesión y se limita por usuario.
apiRouter.use(requireAuth, userLimiter);
apiRouter.get("/dashboard", validate(dashboardSchema), dashboard.show);
apiRouter.use("/users", usersRouter);
apiRouter.use("/subjects", subjectsRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/grades", gradesRouter);
apiRouter.use("/friends", friendsRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/pomodoro", pomodoroRouter);

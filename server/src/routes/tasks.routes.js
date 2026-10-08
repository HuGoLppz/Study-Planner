import { Router } from "express";
import * as tasks from "../controllers/task.controller.js";
import { validate } from "../middleware/validate.js";
import {
  completeTaskSchema,
  createTaskSchema,
  listTasksSchema,
  taskIdSchema,
  updateTaskSchema,
} from "../validators/task.schemas.js";

export const tasksRouter = Router();

tasksRouter.get("/", validate(listTasksSchema), tasks.list);
tasksRouter.get("/summary", tasks.summary);
tasksRouter.post("/", validate(createTaskSchema), tasks.create);
tasksRouter.get("/:taskId", validate(taskIdSchema), tasks.get);
tasksRouter.patch("/:taskId", validate(updateTaskSchema), tasks.update);
tasksRouter.delete("/:taskId", validate(taskIdSchema), tasks.remove);
tasksRouter.post(
  "/:taskId/complete",
  validate(completeTaskSchema),
  tasks.complete,
);
tasksRouter.post("/:taskId/reopen", validate(taskIdSchema), tasks.reopen);

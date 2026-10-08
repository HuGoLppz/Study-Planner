import { Router } from "express";
import * as grades from "../controllers/grade.controller.js";
import { validate } from "../middleware/validate.js";
import {
  gradeSchema,
  gradeStatsSchema,
  listGradesSchema,
  taskIdSchema,
} from "../validators/task.schemas.js";

export const gradesRouter = Router();

gradesRouter.get("/", validate(listGradesSchema), grades.list);
gradesRouter.get("/stats", validate(gradeStatsSchema), grades.stats);
gradesRouter.put("/:taskId", validate(gradeSchema), grades.set);
gradesRouter.delete("/:taskId", validate(taskIdSchema), grades.remove);

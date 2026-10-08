import { Router } from "express";
import * as subjects from "../controllers/subject.controller.js";
import { validate } from "../middleware/validate.js";
import {
  createSubjectSchema,
  subjectIdSchema,
  updateSubjectSchema,
} from "../validators/subject.schemas.js";

export const subjectsRouter = Router();

subjectsRouter.get("/", subjects.list);
subjectsRouter.post("/", validate(createSubjectSchema), subjects.create);
subjectsRouter.patch(
  "/:subjectId",
  validate(updateSubjectSchema),
  subjects.update,
);
subjectsRouter.delete(
  "/:subjectId",
  validate(subjectIdSchema),
  subjects.remove,
);

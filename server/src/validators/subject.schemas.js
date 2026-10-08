import { SUBJECT_COLORS } from "../config/constants.js";
import { idParams, request, z } from "./common.js";

const subjectBody = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).default(""),
  color: z.enum(SUBJECT_COLORS),
});

export const createSubjectSchema = request({ body: subjectBody });

export const updateSubjectSchema = request({
  params: idParams("subjectId"),
  body: subjectBody.partial(),
});

export const subjectIdSchema = request({ params: idParams("subjectId") });

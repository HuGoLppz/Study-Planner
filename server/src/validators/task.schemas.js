import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from "../config/constants.js";
import { date, idParams, numericId, pageLimit, request, z } from "./common.js";

const score = z.coerce
  .number()
  .min(0, "La nota mínima es 0")
  .max(10, "La nota máxima es 10");

const taskBody = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  subjectId: numericId.nullable().default(null),
  type: z.enum(TASK_TYPES).default("assignment"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("pending"),
  dueDate: date,
});

export const createTaskSchema = request({ body: taskBody });

export const updateTaskSchema = request({
  params: idParams("taskId"),
  body: z
    .object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000),
      subjectId: numericId.nullable(),
      type: z.enum(TASK_TYPES),
      priority: z.enum(TASK_PRIORITIES),
      status: z.enum(TASK_STATUSES),
      dueDate: date,
    })
    .partial(),
});

export const taskIdSchema = request({ params: idParams("taskId") });

export const completeTaskSchema = request({
  params: idParams("taskId"),
  body: z.object({ score: score.nullable().optional() }).default({}),
});

export const listTasksSchema = request({
  query: z.object({
    status: z.enum(["all", "pending", "completed", "overdue"]).default("all"),
    subject: z.union([numericId, z.literal("none")]).optional(),
    type: z.enum(TASK_TYPES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    q: z.string().trim().max(80).optional(),
    from: date.optional(),
    to: date.optional(),
    sort: z
      .enum(["due", "-due", "created", "-created", "priority", "completed"])
      .default("due"),
    page: z.coerce.number().int().min(1).default(1),
    limit: pageLimit(200, 50),
  }),
});

export const gradeSchema = request({
  params: idParams("taskId"),
  body: z.object({ score }),
});

export const listGradesSchema = request({
  query: z.object({ subject: numericId.optional() }),
});

export const gradeStatsSchema = request({
  query: z.object({ tz: z.string().max(64).default("UTC") }),
});

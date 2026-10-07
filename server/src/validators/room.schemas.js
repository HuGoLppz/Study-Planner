import { LIMITS, ROOM_ROLES, TASK_STATUSES } from '../config/constants.js';
import { date, idParams, objectId, pageLimit, request, z } from './common.js';

const roomBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
  subjectId: objectId.nullable().default(null),
  scheduledAt: date.nullable().default(null),
});

export const createRoomSchema = request({ body: roomBody });

export const updateRoomSchema = request({
  params: idParams('roomId'),
  body: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500),
    subjectId: objectId.nullable(),
    scheduledAt: date.nullable(),
  }).partial(),
});

export const roomIdSchema = request({ params: idParams('roomId') });

export const agendaSchema = request({
  query: z.object({ from: date, to: date }),
});

export const inviteSchema = request({
  params: idParams('roomId'),
  body: z.object({ userIds: z.array(objectId).min(1).max(LIMITS.membersPerRoom) }),
});

export const roomUserSchema = request({ params: idParams('roomId', 'userId') });

export const memberRoleSchema = request({
  params: idParams('roomId', 'userId'),
  body: z.object({ role: z.enum(ROOM_ROLES) }),
});

const roomTaskBody = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(''),
  dueDate: date.nullable().default(null),
  assigneeId: objectId.nullable().default(null),
  status: z.enum(TASK_STATUSES).default('pending'),
});

export const createRoomTaskSchema = request({ params: idParams('roomId'), body: roomTaskBody });

export const updateRoomTaskSchema = request({
  params: idParams('roomId', 'taskId'),
  body: z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    dueDate: date.nullable(),
    assigneeId: objectId.nullable(),
    status: z.enum(TASK_STATUSES),
  }).partial(),
});

export const roomTaskIdSchema = request({ params: idParams('roomId', 'taskId') });

export const listMessagesSchema = request({
  params: idParams('roomId'),
  query: z.object({ before: objectId.optional(), limit: pageLimit(100, 40) }),
});

export const createMessageSchema = request({
  params: idParams('roomId'),
  body: z.object({ body: z.string().trim().min(1, 'Escribe un mensaje').max(LIMITS.messageLength) }),
});

export const updateMessageSchema = request({
  params: idParams('roomId', 'messageId'),
  body: z.object({ body: z.string().trim().min(1, 'Escribe un mensaje').max(LIMITS.messageLength) }),
});

export const messageIdSchema = request({ params: idParams('roomId', 'messageId') });

export const fileIdSchema = request({ params: idParams('roomId', 'fileId') });

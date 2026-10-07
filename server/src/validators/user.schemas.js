import { PROFILE_VISIBILITY, THEMES } from '../config/constants.js';
import { idParams, pageLimit, request, z } from './common.js';

export const handleRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, 'Usa entre 3 y 30 caracteres: letras, números, punto o guion bajo');

export const searchUsersSchema = request({
  query: z.object({
    q: z.string().trim().min(2, 'Escribe al menos 2 caracteres').max(60),
    limit: pageLimit(30, 20),
  }),
});

export const profileByHandleSchema = request({
  params: z.object({ handle: handleRule }),
});

export const userIdParamsSchema = request({ params: idParams('userId') });

export const updateProfileSchema = request({
  body: z
    .object({
      name: z.string().trim().min(2).max(80),
      handle: handleRule,
      studies: z.string().trim().min(2).max(120),
      course: z.string().trim().min(1).max(40),
      bio: z.string().trim().max(500),
    })
    .partial(),
});

export const updatePrivacySchema = request({
  body: z
    .object({
      profileVisibility: z.enum(PROFILE_VISIBILITY),
      searchable: z.boolean(),
      showGrades: z.boolean(),
    })
    .partial(),
});

export const updatePreferencesSchema = request({
  body: z.object({ theme: z.enum(THEMES) }).partial(),
});

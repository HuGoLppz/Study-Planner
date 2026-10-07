import { request, z } from './common.js';

export const passwordRule = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128)
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

export const registerSchema = request({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordRule,
    studies: z.string().trim().min(2).max(120),
    course: z.string().trim().min(1).max(40),
    bio: z.string().trim().max(500).default(''),
  }),
});

export const loginSchema = request({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1, 'Introduce tu contraseña').max(128),
  }),
});

export const changePasswordSchema = request({
  body: z.object({
    currentPassword: z.string().min(1, 'Introduce tu contraseña actual').max(128),
    newPassword: passwordRule,
  }),
});

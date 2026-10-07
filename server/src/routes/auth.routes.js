import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { authLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema, registerSchema } from '../validators/auth.schemas.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), auth.register);
authRouter.post('/login', authLimiter, validate(loginSchema), auth.login);
authRouter.post('/logout', auth.logout);
authRouter.get('/me', requireAuth, auth.me);
authRouter.patch('/password', requireAuth, authLimiter, validate(changePasswordSchema), auth.changePassword);

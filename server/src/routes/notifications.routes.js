import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { validate } from '../middleware/validate.js';
import {
  listNotificationsSchema,
  notificationIdSchema,
  updateNotificationSchema,
} from '../validators/notification.schemas.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', validate(listNotificationsSchema), notifications.list);
notificationsRouter.get('/unread-count', notifications.unreadCount);
notificationsRouter.post('/read-all', notifications.readAll);
notificationsRouter.patch('/:notificationId', validate(updateNotificationSchema), notifications.update);
notificationsRouter.delete('/:notificationId', validate(notificationIdSchema), notifications.remove);

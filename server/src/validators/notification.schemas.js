import {
  booleanString,
  idParams,
  numericId,
  pageLimit,
  request,
  z,
} from "./common.js";

export const listNotificationsSchema = request({
  query: z.object({
    unread: booleanString.optional(),
    before: numericId.optional(),
    limit: pageLimit(50, 20),
  }),
});

export const notificationIdSchema = request({
  params: idParams("notificationId"),
});

export const updateNotificationSchema = request({
  params: idParams("notificationId"),
  body: z.object({ read: z.boolean() }),
});

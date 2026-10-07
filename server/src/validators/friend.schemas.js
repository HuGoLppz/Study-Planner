import { idParams, objectId, request, z } from './common.js';

export const sendRequestSchema = request({
  body: z.object({ userId: objectId }),
});

export const requestIdSchema = request({ params: idParams('requestId') });

export const friendIdSchema = request({ params: idParams('userId') });

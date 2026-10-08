import { idParams, publicId, request, z } from "./common.js";

export const sendRequestSchema = request({
  body: z.object({ userId: publicId }),
});

export const requestIdSchema = request({ params: idParams("requestId") });

export const friendIdSchema = request({ params: idParams("userId") });

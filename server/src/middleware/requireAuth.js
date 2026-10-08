import { authenticateToken } from "../auth/session.js";
import { env } from "../config/env.js";

export async function requireAuth(req, _res, next) {
  req.user = await authenticateToken(req.cookies?.[env.cookieName]);
  next();
}

import { env } from "../config/env.js";

const baseOptions = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: "/",
});

export function setSessionCookie(res, token) {
  res.cookie(env.cookieName, token, {
    ...baseOptions(),
    maxAge: env.sessionDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, baseOptions());
}

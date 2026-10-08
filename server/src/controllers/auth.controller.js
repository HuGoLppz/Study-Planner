import { clearSessionCookie, setSessionCookie } from "../auth/cookies.js";
import { signSessionToken } from "../auth/tokens.js";
import { serializeSelf } from "../serializers/user.serializer.js";
import * as authService from "../services/auth.service.js";

function startSession(res, user) {
  setSessionCookie(res, signSessionToken(user));
}

export async function register(req, res) {
  const user = await authService.registerUser(req.valid.body);
  startSession(res, user);
  res.status(201).json({ user: serializeSelf(user) });
}

export async function login(req, res) {
  const user = await authService.loginUser(req.valid.body);
  startSession(res, user);
  res.json({ user: serializeSelf(user) });
}

export function logout(_req, res) {
  clearSessionCookie(res);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ user: serializeSelf(req.user) });
}

export async function changePassword(req, res) {
  const user = await authService.changePassword(req.user._id, req.valid.body);
  startSession(res, user);
  res.status(204).end();
}

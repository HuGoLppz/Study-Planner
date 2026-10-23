import { clearSessionCookie, setSessionCookie } from "../auth/cookies.js";
import { signSessionToken } from "../auth/tokens.js";
import { serializeSelf } from "../serializers/user.serializer.js";
import * as authService from "../services/auth.service.js";
import * as oauth from "../services/oauth.service.js";

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

export function oauthProviders(_req, res) {
  res.json({ providers: oauth.publicProviders() });
}

export async function oauthLogin(req, res) {
  const { provider } = req.valid.params;
  const user = await oauth.loginWithProvider(
    provider,
    req.valid.body.credential,
  );
  startSession(res, user);
  res.json({ user: serializeSelf(user) });
}

export async function oauthLinks(req, res) {
  res.json({ links: await oauth.listLinks(req.user._id) });
}

export async function oauthLink(req, res) {
  const { provider } = req.valid.params;
  const link = await oauth.linkAccount(
    req.user._id,
    provider,
    req.valid.body.credential,
  );
  res.status(201).json({ link });
}

export async function oauthUnlink(req, res) {
  await oauth.unlinkAccount(req.user._id, req.valid.params.provider);
  res.status(204).end();
}

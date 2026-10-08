import { pipeline } from "node:stream/promises";
import { serializeSelf } from "../serializers/user.serializer.js";
import * as userService from "../services/user.service.js";

export async function search(req, res) {
  const users = await userService.searchUsers(req.user, req.valid.query);
  res.json({ items: users });
}

export async function profile(req, res) {
  const profileData = await userService.getProfile(
    req.user,
    req.valid.params.handle,
  );
  res.json({ profile: profileData });
}

export async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user, req.valid.body);
  res.json({ user: serializeSelf(user) });
}

export async function updatePrivacy(req, res) {
  const user = await userService.updatePrivacy(req.user, req.valid.body);
  res.json({ user: serializeSelf(user) });
}

export async function updatePreferences(req, res) {
  const user = await userService.updatePreferences(req.user, req.valid.body);
  res.json({ user: serializeSelf(user) });
}

export async function uploadAvatar(req, res) {
  const user = await userService.setAvatar(req.user, req.file);
  res.json({ user: serializeSelf(user) });
}

export async function deleteAvatar(req, res) {
  const user = await userService.removeAvatar(req.user);
  res.json({ user: serializeSelf(user) });
}

export async function avatar(req, res) {
  const { stream, mimeType } = await userService.getAvatarFile(
    req.valid.params.userId,
  );
  // La URL lleva ?v=<fecha de la foto>: si la foto cambia, cambia la URL, así que puede cachearse sin caducar.
  res.set("Cache-Control", "private, max-age=31536000, immutable");
  res.type(mimeType);
  await pipeline(stream, res);
}

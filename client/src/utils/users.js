import { API_URL } from "../services/http.js";

export function avatarUrl(user) {
  const updatedAt = user?.avatar?.updatedAt;
  if (!updatedAt) return null;
  return `${API_URL}/users/${user._id}/avatar?v=${new Date(updatedAt).getTime()}`;
}

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

export const firstName = (name = "") => name.trim().split(/\s+/)[0] ?? "";

export function academicLine(user) {
  if (!user) return "";
  const course = user.course ? `${user.course} curso` : "";
  return [user.studies, course].filter(Boolean).join(", ");
}

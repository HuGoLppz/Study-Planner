// Valores de dominio compartidos por modelos, validadores y servicios.
// Los colores se guardan como nombres: el cliente decide el tono exacto según el tema.

export const SUBJECT_COLORS = [
  "yellow",
  "pink",
  "green",
  "orange",
  "blue",
  "lilac",
  "mint",
  "coral",
];

export const TASK_TYPES = [
  "exam",
  "assignment",
  "project",
  "reading",
  "practice",
  "presentation",
  "other",
];
export const TASK_PRIORITIES = ["low", "medium", "high"];
export const TASK_STATUSES = ["pending", "in_progress", "completed"];

export const ROOM_ROLES = ["admin", "member"];

// Proveedores de inicio de sesión externos que se pueden vincular a una cuenta.
export const OAUTH_PROVIDERS = ["google", "apple"];

export const PROFILE_VISIBILITY = ["public", "friends", "private"];
export const THEMES = ["system", "light", "dark"];

export const POMODORO_PHASES = ["focus", "break"];

export const NOTIFICATION_TYPES = [
  "friend_request",
  "friend_accepted",
  "room_invitation",
  "room_member_joined",
  "room_role_changed",
  "room_task_assigned",
  "task_due",
];

export const LIMITS = Object.freeze({
  subjectsPerUser: 40,
  membersPerRoom: 50,
  tasksPerRoom: 200,
  filesPerRoom: 300,
  sessionsPerDay: 200,
  messageLength: 2000,
});

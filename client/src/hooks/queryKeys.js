// Claves de caché de TanStack Query. Agrupadas por recurso para invalidar en bloque.
export const qk = {
  me: ["auth", "me"],
  dashboard: (params) => ["dashboard", params],
  tasks: {
    all: ["tasks"],
    list: (filters) => ["tasks", "list", filters],
    range: (from, to) => ["tasks", "range", from, to],
    detail: (id) => ["tasks", "detail", id],
    summary: ["tasks", "summary"],
    completed: ["tasks", "completed-ungraded"],
  },
  grades: {
    all: ["grades"],
    list: ["grades", "list"],
    stats: ["grades", "stats"],
  },
  friends: {
    all: ["friends"],
    list: ["friends", "list"],
    requests: ["friends", "requests"],
    search: (q) => ["friends", "search", q],
  },
  profile: (handle) => ["profile", handle],
  rooms: {
    all: ["rooms"],
    list: ["rooms", "list"],
    invitations: ["rooms", "invitations"],
    agenda: (from, to) => ["rooms", "agenda", from, to],
    detail: (id) => ["rooms", "detail", id],
    messages: (id) => ["rooms", "messages", id],
    files: (id) => ["rooms", "files", id],
  },
  notifications: {
    all: ["notifications"],
    list: (unread) => ["notifications", "list", { unread: Boolean(unread) }],
    unread: ["notifications", "unread"],
  },
  pomodoro: {
    all: ["pomodoro"],
    settings: ["pomodoro", "settings"],
    day: (day) => ["pomodoro", "day", day],
    history: (from, to) => ["pomodoro", "history", from, to],
  },
};

// Cambios en tareas o notas afectan a listas, calendario, estadísticas, dashboard y perfil.
export function invalidateAcademic(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
    queryClient.invalidateQueries({ queryKey: qk.grades.all }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["profile"] }),
  ]);
}

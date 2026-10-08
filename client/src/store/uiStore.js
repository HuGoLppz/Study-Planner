import { create } from "zustand";

// Estado de interfaz compartido entre páginas: el panel de tarea se abre desde el dashboard,
// el calendario, las notificaciones o la lista de tareas.
export const useUiStore = create((set) => ({
  taskPanel: null, // { mode: 'view' | 'edit' | 'create', taskId?, defaults?, focus? }
  notificationsOpen: false,

  openTask: (taskId, options = {}) =>
    set({ taskPanel: { mode: "view", taskId, ...options } }),
  editTask: (taskId) => set({ taskPanel: { mode: "edit", taskId } }),
  createTask: (defaults = {}) =>
    set({ taskPanel: { mode: "create", defaults } }),
  closeTask: () => set({ taskPanel: null }),

  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
}));

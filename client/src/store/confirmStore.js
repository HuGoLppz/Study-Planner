import { create } from "zustand";

// Confirmaciones como promesa: `if (await confirm({...})) borrar()`.
export const useConfirmStore = create((set, get) => ({
  request: null,

  ask: (options) =>
    new Promise((resolve) => {
      get().request?.resolve(false);
      set({ request: { ...options, resolve } });
    }),

  answer: (value) => {
    get().request?.resolve(value);
    set({ request: null });
  },
}));

export const confirm = (options) => useConfirmStore.getState().ask(options);

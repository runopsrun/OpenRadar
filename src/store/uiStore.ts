import { create } from "zustand";

export type PanelId = "layers" | "settings";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
}

interface UiStore {
  panel: PanelId | null;
  aboutOpen: boolean;
  toasts: ToastMessage[];
  setPanel: (panel: PanelId | null) => void;
  togglePanel: (panel: PanelId) => void;
  setAboutOpen: (open: boolean) => void;
  pushToast: (toast: Omit<ToastMessage, "id"> & { id?: number }) => number;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

/**
 * Small UI-only store: side panels, modal, and transient notifications.
 * Keeping this separate prevents panel animations from re-rendering the map.
 */
export const useUiStore = create<UiStore>((set, get) => ({
  panel: null,
  aboutOpen: false,
  toasts: [],

  setPanel: (panel) => set({ panel }),

  togglePanel: (panel) =>
    set((state) => ({ panel: state.panel === panel ? null : panel })),

  setAboutOpen: (open) => set({ aboutOpen: open }),

  pushToast: (toast) => {
    const id = toast.id ?? nextToastId++;
    const entry: ToastMessage = { ...toast, id };

    set((state) => {
      const next = [...state.toasts, entry];
      return { toasts: next.slice(-3) };
    });

    const timeout = toast.tone === "error" ? 9_000 : 5_500;
    window.setTimeout(() => {
      // Guard in case the toast was already dismissed.
      if (get().toasts.some((item) => item.id === id)) {
        get().dismissToast(id);
      }
    }, timeout);

    return id;
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function toast(input: Omit<ToastMessage, "id">): number {
  return useUiStore.getState().pushToast(input);
}

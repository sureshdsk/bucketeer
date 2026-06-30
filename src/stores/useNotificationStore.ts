import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type NotificationKind = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
}

interface NotificationState {
  items: AppNotification[];
  push: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  immer((set) => ({
    items: [],
    push: (n) =>
      set((s) => {
        s.items.unshift({
          ...n,
          id: `n-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: Date.now(),
          read: false,
        });
        // Keep the buffer bounded.
        if (s.items.length > 100) s.items.length = 100;
      }),
    markAllRead: () =>
      set((s) => {
        for (const item of s.items) item.read = true;
      }),
    clear: () =>
      set((s) => {
        s.items = [];
      }),
  })),
);

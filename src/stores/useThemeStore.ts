import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  init: () => () => void;
}

const media =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") return media?.matches ? "light" : "dark";
  return theme;
}

function apply(mode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("light", mode === "light");
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolved: resolve("system"),
      setTheme: (theme) => {
        const resolved = resolve(theme);
        apply(resolved);
        set({ theme, resolved });
      },
      toggle: () => {
        const next = get().resolved === "light" ? "dark" : "light";
        set({ theme: next, resolved: next });
        apply(next);
      },
      init: () => {
        const state = get();
        const resolved = resolve(state.theme);
        apply(resolved);
        set({ resolved });
        const sync = () => {
          if (get().theme !== "system") return;
          const r = resolve("system");
          apply(r);
          set({ resolved: r });
        };
        media?.addEventListener("change", sync);
        return () => media?.removeEventListener("change", sync);
      },
    }),
    {
      name: "bucketeer.theme",
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);

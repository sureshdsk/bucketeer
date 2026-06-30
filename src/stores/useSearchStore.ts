import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { listen } from "@tauri-apps/api/event";

import {
  deepSearch,
  SEARCH_CHANNEL,
  type SearchEnvelope,
  type SearchHit,
} from "@/lib/ipc";

interface SearchState {
  open: boolean;
  query: string;
  active: boolean;
  hits: SearchHit[];
  matches: number;
  lastError: string | null;
  setOpen: (open: boolean) => void;
  setQuery: (q: string) => void;
  clear: () => void;
  run: (args: {
    bucketId: string;
    bucket: string;
    prefix: string;
  }) => Promise<void>;
  subscribe: () => Promise<() => void>;
}

export const useSearchStore = create<SearchState>()(
  immer((set, get) => ({
    open: false,
    query: "",
    active: false,
    hits: [],
    matches: 0,
    lastError: null,

    setOpen: (open) =>
      set((s) => {
        s.open = open;
        if (!open) {
          s.active = false;
        }
      }),

    setQuery: (q) =>
      set((s) => {
        s.query = q;
      }),

    clear: () =>
      set((s) => {
        s.query = "";
        s.hits = [];
        s.matches = 0;
        s.active = false;
        s.lastError = null;
      }),

    run: async ({ bucketId, bucket, prefix }) => {
      const q = get().query.trim();
      if (!q) return;
      set((s) => {
        s.active = true;
        s.hits = [];
        s.matches = 0;
        s.lastError = null;
      });
      try {
        await deepSearch({ bucketId, bucket, prefix, query: q });
      } catch (err) {
        set((s) => {
          s.active = false;
          s.lastError = stringify(err);
        });
      }
    },

    subscribe: async () => {
      const unlisten = await listen<SearchEnvelope>(SEARCH_CHANNEL, (event) => {
        const p = event.payload;
        set((s) => {
          // Only show hits for the in-flight query.
          if (s.query && p.query !== s.query) return;
          if (p.done) {
            s.active = false;
            s.matches = p.matches;
            return;
          }
          if (p.hit) {
            s.hits.push(p.hit);
            s.matches = p.matches;
          }
        });
      });
      return unlisten;
    },
  })),
);

function stringify(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

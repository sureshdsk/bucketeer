import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import {
  deleteLocation,
  listLocations,
  reorderLocations,
  saveLocation,
  type StoredLocation,
} from "@/lib/ipc";
import { openTarget } from "@/lib/navigation";

interface LocationsState {
  items: StoredLocation[];
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  save: (loc: StoredLocation) => Promise<void>;
  remove: (id: string) => Promise<void>;
  move: (id: string, dir: -1 | 1) => Promise<void>;
  /** Activate the location's provider, then open its bucket/prefix. */
  open: (loc: StoredLocation) => Promise<void>;
}

export const useLocationsStore = create<LocationsState>()(
  immer((set, get) => ({
    items: [],
    status: "idle",

    load: async () => {
      set((s) => {
        s.status = "loading";
      });
      try {
        const items = await listLocations();
        set((s) => {
          s.items = items;
          s.status = "ready";
        });
      } catch {
        set((s) => {
          s.status = "error";
        });
      }
    },

    save: async (loc) => {
      const items = await saveLocation({
        id: loc.id,
        label: loc.label,
        providerId: loc.provider_id,
        bucket: loc.bucket,
        prefix: loc.prefix,
        color: loc.color,
        createdAt: loc.created_at,
      });
      set((s) => {
        s.items = items;
      });
    },

    remove: async (id) => {
      const items = await deleteLocation(id);
      set((s) => {
        s.items = items;
      });
    },

    move: async (id, dir) => {
      const order = get().items.map((l) => l.id);
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      const items = await reorderLocations(order);
      set((s) => {
        s.items = items;
      });
    },

    open: async (loc) => {
      await openTarget(loc.provider_id, loc.bucket, loc.prefix);
    },
  })),
);

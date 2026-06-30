import { create } from "zustand";
import { persist } from "zustand/middleware";

import { listBuckets, type Bucket } from "@/lib/ipc";

interface BucketState {
  buckets: Bucket[];
  active: Bucket | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  select: (id: string) => void;
}

export const useBucketStore = create<BucketState>()(
  persist(
    (set, get) => ({
      buckets: [],
      active: null,
      status: "idle",
      error: null,

      refresh: async () => {
        set({ status: "loading", error: null });
        try {
          const buckets = await listBuckets();
          const prevId = get().active?.id;
          const active =
            buckets.find((p) => p.id === prevId) ?? buckets[0] ?? null;
          set({ buckets, active, status: "ready" });
        } catch (err) {
          set({ status: "error", error: stringifyError(err) });
        }
      },

      select: (id) => {
        const bucket = get().buckets.find((p) => p.id === id) ?? null;
        set({ active: bucket });
      },
    }),
    {
      name: "bucketeer.bucket",
      partialize: (state) => ({ active: state.active }),
    },
  ),
);

function stringifyError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

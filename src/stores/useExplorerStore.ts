import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import {
  listRemoteBuckets,
  listObjects,
  type ObjectMeta,
  type RemoteBucket,
} from "@/lib/ipc";

const PAGE_SIZE = 200;

interface ExplorerState {
  bucketId: string | null;
  remoteBuckets: RemoteBucket[];
  remoteBucketsAccessDenied: boolean;
  remoteBucketsError: string | null;

  bucket: string | null;
  prefix: string;
  items: ObjectMeta[];
  nextCursor: string | null;
  total: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  selected: ObjectMeta | null;
  /** Multi-select for the bulk action bar (keyed by object key). */
  multiSelect: Record<string, ObjectMeta>;

  loadRemoteBuckets: (bucketId: string) => Promise<void>;
  /** Sync the explorer's active bucket id without resetting the view. Safe to
   * call reactively (e.g. on active-bucket change) — never clobbers bucket or
   * items, so it can't race an in-progress navigation. */
  setActiveBucket: (bucketId: string) => void;
  /** Clear the current view (bucket, prefix, items, selection). Used when
   * switching buckets as a deliberate, sequential reset. */
  resetView: () => void;
  openBucket: (bucket: string) => Promise<void>;
  openFolder: (key: string) => Promise<void>;
  navigateToSegment: (index: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  select: (meta: ObjectMeta | null) => void;
  toggleMulti: (meta: ObjectMeta) => void;
  setMulti: (items: ObjectMeta[]) => void;
  clearMulti: () => void;
  parseAndOpenPath: (raw: string) => Promise<void>;
}

export const useExplorerStore = create<ExplorerState>()(
  immer((set, get) => {
    async function loadPrefix(
      bucketId: string,
      bucket: string,
      prefix: string,
      cursor: string | null,
      append: boolean,
    ) {
      set((s) => {
        s.status = "loading";
        s.error = null;
      });
      try {
        const page = await listObjects({ bucketId, bucket, prefix, cursor, pageSize: PAGE_SIZE });
        set((s) => {
          if (append) {
            s.items.push(...page.items);
          } else {
            s.items = page.items;
          }
          s.nextCursor = page.next_cursor;
          s.total = page.total;
          s.status = "ready";
        });
      } catch (err) {
        set((s) => {
          s.status = "error";
          s.error = errToString(err);
        });
      }
    }

    return {
      bucketId: null,
      remoteBuckets: [],
      remoteBucketsAccessDenied: false,
      remoteBucketsError: null,

      bucket: null,
      prefix: "",
      items: [],
      nextCursor: null,
      total: 0,
      status: "idle",
      error: null,
      selected: null,
      multiSelect: {},

      loadRemoteBuckets: async (bucketId) => {
        set((s) => {
          s.bucketId = bucketId;
          s.remoteBuckets = [];
          s.remoteBucketsAccessDenied = false;
          s.remoteBucketsError = null;
          s.bucket = null;
          s.prefix = "";
          s.items = [];
          s.selected = null;
          s.multiSelect = {};
          s.status = "idle";
        });
        try {
          const buckets = await listRemoteBuckets(bucketId);
          set((s) => {
            s.remoteBuckets = buckets;
          });
        } catch (err) {
          const { code } = errorCode(err);
          set((s) => {
            s.remoteBucketsAccessDenied = code === "AccessDenied";
            s.remoteBucketsError = errToString(err);
          });
        }
      },

      openBucket: async (bucket) => {
        const bucketId = get().bucketId;
        if (!bucketId) return;
        set((s) => {
          s.bucket = bucket;
          s.prefix = "";
          s.selected = null;
          s.multiSelect = {};
          s.items = [];
          s.nextCursor = null;
          s.total = 0;
          s.status = "loading";
          s.error = null;
        });
        await loadPrefix(bucketId, bucket, "", null, false);
      },

      setActiveBucket: (bucketId) => {
        set((s) => {
          s.bucketId = bucketId;
        });
      },

      resetView: () => {
        set((s) => {
          s.bucket = null;
          s.prefix = "";
          s.items = [];
          s.selected = null;
          s.multiSelect = {};
          s.status = "idle";
          s.error = null;
        });
      },

      openFolder: async (key) => {
        const bucketId = get().bucketId;
        const bucket = get().bucket;
        if (!bucketId || !bucket) return;
        set((s) => {
          s.prefix = key;
          s.selected = null;
          s.multiSelect = {};
          s.items = [];
          s.nextCursor = null;
          s.total = 0;
          s.status = "loading";
          s.error = null;
        });
        await loadPrefix(bucketId, bucket, key, null, false);
      },

      navigateToSegment: async (index) => {
        const bucketId = get().bucketId;
        const bucket = get().bucket;
        if (!bucketId || !bucket) return;
        const parts = get().prefix.split("/").filter(Boolean);
        const clamped = Math.max(0, Math.min(index, parts.length));
        const prefix = clamped === 0 ? "" : `${parts.slice(0, clamped).join("/")}/`;
        set((s) => {
          s.prefix = prefix;
          s.selected = null;
          s.multiSelect = {};
          s.items = [];
          s.nextCursor = null;
          s.total = 0;
          s.status = "loading";
          s.error = null;
        });
        await loadPrefix(bucketId, bucket, prefix, null, false);
      },

      loadMore: async () => {
        const { bucketId, bucket, prefix, nextCursor } = get();
        if (!bucketId || !bucket || nextCursor === null) return;
        await loadPrefix(bucketId, bucket, prefix, nextCursor, true);
      },

      refresh: async () => {
        const { bucketId, bucket, prefix } = get();
        if (!bucketId || !bucket) return;
        await loadPrefix(bucketId, bucket, prefix, null, false);
      },

      select: (meta) => {
        set((s) => {
          s.selected = meta;
        });
      },

      toggleMulti: (meta) => {
        set((s) => {
          if (s.multiSelect[meta.key]) {
            delete s.multiSelect[meta.key];
          } else {
            s.multiSelect[meta.key] = meta;
          }
        });
      },

      setMulti: (items) => {
        set((s) => {
          s.multiSelect = {};
          for (const item of items) {
            s.multiSelect[item.key] = item;
          }
        });
      },

      clearMulti: () => {
        set((s) => {
          s.multiSelect = {};
        });
      },

      parseAndOpenPath: async (raw) => {
        const bucketId = get().bucketId;
        if (!bucketId) return;
        const clean = raw.trim().replace(/^s3:\/\//i, "");
        const parts = clean.split("/").filter(Boolean);
        if (parts.length === 0) return;
        const [bucket, ...rest] = parts;
        const prefix = rest.length === 0 ? "" : `${rest.join("/")}/`;
        set((s) => {
          s.bucket = bucket;
          s.prefix = prefix;
          s.selected = null;
          s.multiSelect = {};
          s.items = [];
          s.nextCursor = null;
          s.total = 0;
          s.status = "loading";
          s.error = null;
        });
        await loadPrefix(bucketId, bucket, prefix, null, false);
      },
    };
  }),
);

function errToString(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function errorCode(err: unknown): { code: string } {
  if (err && typeof err === "object" && "code" in err) {
    return { code: String((err as { code: unknown }).code) };
  }
  return { code: "" };
}

export function breadcrumbSegments(bucket: string | null, prefix: string): string[] {
  if (!bucket) return [];
  return [bucket, ...prefix.split("/").filter(Boolean)];
}

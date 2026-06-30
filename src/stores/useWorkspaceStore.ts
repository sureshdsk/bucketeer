import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Bucket } from "@/lib/ipc";

/**
 * A workspace tab isolates `(bucket_id, bucket, prefix)` so the user can
 * compare different buckets side-by-side without cross-contamination
 * (`feature.md:30`). The active tab drives which saved bucket + target the
 * explorer store points at; switching tabs restores the cached view.
 */
export interface WorkspaceTab {
  id: string;
  bucketId: string;
  bucketName: string;
  bucket: string | null;
  prefix: string;
  label: string;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  newTab: (bucket: Bucket, target?: string | null, prefix?: string) => string;
  closeTab: (id: string) => void;
  activate: (id: string) => void;
  updateActive: (patch: Partial<Omit<WorkspaceTab, "id" | "label">>) => void;
  renameTab: (id: string, label: string) => void;
}

const LABEL_LIMIT = 24;

function labelFor(bucket?: string | null, bucketName?: string): string {
  const base = bucket ?? bucketName ?? "New tab";
  if (base.length <= LABEL_LIMIT) return base;
  return `${base.slice(0, LABEL_LIMIT - 1)}…`;
}

function makeId(): string {
  return `tab-${Math.random().toString(36).slice(2, 9)}`;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      tabs: [],
      activeTabId: null,

      newTab: (_bucket, target = _bucket.bucket, prefix = _bucket.prefix ?? "") => {
        const id = makeId();
        const tab: WorkspaceTab = {
          id,
          bucketId: _bucket.id,
          bucketName: _bucket.name,
          bucket: target,
          prefix,
          label: labelFor(target, _bucket.name),
        };
        set((s) => ({
          tabs: [...s.tabs, tab],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (id) => {
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id);
          if (idx < 0) return s;
          const nextTabs = s.tabs.filter((t) => t.id !== id);
          let nextActive = s.activeTabId;
          if (s.activeTabId === id) {
            const fallback = nextTabs[idx] ?? nextTabs[idx - 1] ?? nextTabs[0] ?? null;
            nextActive = fallback?.id ?? null;
          }
          return { tabs: nextTabs, activeTabId: nextActive };
        });
      },

      activate: (id) => {
        set((s) => {
          if (s.tabs.some((t) => t.id === id)) {
            return { activeTabId: id };
          }
          return s;
        });
      },

      updateActive: (patch) => {
        set((s) => {
          if (!s.activeTabId) return s;
          return {
            tabs: s.tabs.map((t) => {
              if (t.id !== s.activeTabId) return t;
              const merged = { ...t, ...patch };
              const relabel =
                patch.bucket !== undefined || patch.bucketName !== undefined;
              return {
                ...merged,
                label: relabel
                  ? labelFor(merged.bucket, merged.bucketName)
                  : t.label,
              };
            }),
          };
        });
      },

      renameTab: (id, label) => {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
        }));
      },
    }),
    {
      name: "bucketeer.workspace",
      partialize: (s) => ({ tabs: s.tabs, activeTabId: s.activeTabId }),
    },
  ),
);

/** Convenience selector for the currently active tab. */
export function selectActiveTab(state: WorkspaceState): WorkspaceTab | null {
  if (!state.activeTabId) return null;
  return state.tabs.find((t) => t.id === state.activeTabId) ?? null;
}

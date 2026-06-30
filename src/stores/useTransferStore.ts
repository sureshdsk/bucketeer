import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { listen } from "@tauri-apps/api/event";

import {
  cancelTransfer,
  TRANSFER_CHANNEL,
  type TransferKind,
  type TransferPhase,
  type TransferProgress,
} from "@/lib/ipc";

export interface TransferRow {
  id: string;
  kind: TransferKind;
  key: string;
  phase: TransferPhase;
  bytes: number;
  total: number;
  progress: number;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
}

interface TransferState {
  transfers: Record<string, TransferRow>;
  drawerOpen: boolean;
  subscribe: () => Promise<() => void>;
  enqueue: (row: Omit<TransferRow, "startedAt" | "finishedAt">) => void;
  setDrawerOpen: (open: boolean) => void;
  retry: (row: TransferRow) => void;
  clearCompleted: () => void;
  cancel: (id: string, kind: TransferKind) => Promise<void>;
}

export const useTransferStore = create<TransferState>()(
  immer((set) => ({
    transfers: {},
    drawerOpen: false,

    subscribe: async () => {
      const unlisten = await listen<TransferProgress>(
        TRANSFER_CHANNEL,
        (event) => {
          const p = event.payload;
          set((s) => {
            const existing = s.transfers[p.id];
            const isTerminal =
              p.phase === "completed" || p.phase === "failed" || p.phase === "cancelled";
            s.transfers[p.id] = {
              id: p.id,
              kind: p.kind,
              key: p.key,
              phase: p.phase,
              bytes: p.bytes,
              total: p.total,
              progress: p.progress,
              error: p.error,
              startedAt: existing?.startedAt ?? Date.now(),
              finishedAt: isTerminal ? Date.now() : existing?.finishedAt ?? null,
            };
            // Open the drawer when a fresh transfer starts.
            if (p.phase === "starting" || p.phase === "queued") {
              s.drawerOpen = true;
            }
          });
        },
      );
      return unlisten;
    },

    enqueue: (row) => {
      set((s) => {
        s.transfers[row.id] = {
          ...row,
          startedAt: Date.now(),
          finishedAt: null,
        };
        s.drawerOpen = true;
      });
    },

    setDrawerOpen: (open) => {
      set((s) => {
        s.drawerOpen = open;
      });
    },

    retry: (_row) => {
      // Retry is re-enqueued by the caller (we don't have the local-path
      // context here). Placeholder so the UI can wire future retry logic.
    },

    clearCompleted: () => {
      set((s) => {
        for (const id of Object.keys(s.transfers)) {
          const t = s.transfers[id];
          if (t.phase === "completed" || t.phase === "failed" || t.phase === "cancelled") {
            delete s.transfers[id];
          }
        }
      });
    },

    cancel: async (id, kind) => {
      try {
        await cancelTransfer(id, kind);
      } catch (err) {
        console.error("cancel transfer failed", err);
      }
      set((s) => {
        if (s.transfers[id]) {
          s.transfers[id].phase = "cancelled";
          s.transfers[id].finishedAt = Date.now();
        }
      });
    },
  })),
);

/** Convenience selector helpers. */
export function selectActiveTransfers(state: TransferState): TransferRow[] {
  return Object.values(state.transfers).filter(
    (t) => !t.finishedAt || t.phase === "active" || t.phase === "queued" || t.phase === "starting",
  );
}

export function selectTransferCount(state: TransferState): number {
  return Object.keys(state.transfers).length;
}

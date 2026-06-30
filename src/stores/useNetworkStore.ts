import { create } from "zustand";
import type { StoreApi } from "zustand";

export interface NetworkOp {
  id: string;
  command: string;
  startedAt: number;
  endedAt: number | null;
  status: "active" | "completed" | "error";
  error?: string;
}

interface NetworkState {
  inFlightCount: number;
  pendingVisible: boolean;
  recent: NetworkOp[];
  showTimer: number | null;
  hideTimer: number | null;
  begin: (command: string) => string;
  complete: (id: string) => void;
  error: (id: string, message: string) => void;
}

const SHOW_DELAY_MS = 200;
const MIN_VISIBLE_MS = 300;
const MAX_RECENT = 20;

let nextId = 0;

function trimRecent(recent: NetworkOp[]): NetworkOp[] {
  return recent.slice(0, MAX_RECENT);
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  inFlightCount: 0,
  pendingVisible: false,
  recent: [],
  showTimer: null,
  hideTimer: null,

  begin: (command) => {
    const id = `op-${++nextId}`;
    const op: NetworkOp = {
      id,
      command,
      startedAt: Date.now(),
      endedAt: null,
      status: "active",
    };

    set((state) => {
      if (state.hideTimer) {
        window.clearTimeout(state.hideTimer);
      }
      let showTimer = state.showTimer;
      if (!state.pendingVisible && !showTimer) {
        showTimer = window.setTimeout(() => {
          set({ pendingVisible: true, showTimer: null });
        }, SHOW_DELAY_MS);
      }
      return {
        inFlightCount: state.inFlightCount + 1,
        recent: trimRecent([op, ...state.recent]),
        showTimer,
        hideTimer: null,
      };
    });

    return id;
  },

  complete: (id) => finishOp(set as StoreApi<NetworkState>["setState"], get, id, "completed"),
  error: (id, message) =>
    finishOp(set as StoreApi<NetworkState>["setState"], get, id, "error", message),
}));

function finishOp(
  set: StoreApi<NetworkState>["setState"],
  get: () => NetworkState,
  id: string,
  status: "completed" | "error",
  message?: string,
) {
  const state = get();
  const endedAt = Date.now();
  const newCount = Math.max(0, state.inFlightCount - 1);
  const recent = state.recent.map((op) =>
    op.id === id ? { ...op, status, endedAt, error: message } : op,
  );

  if (newCount === 0) {
    if (state.showTimer) {
      window.clearTimeout(state.showTimer);
    }
    const hideTimer = window.setTimeout(
      () => set({ pendingVisible: false, hideTimer: null }),
      MIN_VISIBLE_MS,
    );
    set({
      inFlightCount: 0,
      recent: trimRecent(recent),
      showTimer: null,
      hideTimer,
    });
  } else {
    set({
      inFlightCount: newCount,
      recent: trimRecent(recent),
    });
  }
}

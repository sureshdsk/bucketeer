import { useNetworkStore } from "@/stores/useNetworkStore";

export function GlobalProgress() {
  const visible = useNetworkStore((s) => s.pendingVisible);
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Network activity in progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] overflow-hidden bg-primary/15"
    >
      <div className="loading-bar-segment h-full w-1/4 rounded-full bg-primary" />
    </div>
  );
}

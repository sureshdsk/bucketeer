import { Activity } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useNetworkStore } from "@/stores/useNetworkStore";
import { cn } from "@/lib/utils";

export function NetworkActivityButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const inFlight = useNetworkStore((s) => s.inFlightCount);
  const recent = useNetworkStore((s) => s.recent);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Network activity"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
      >
        <Activity className="h-4 w-4" />
        {inFlight > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 origin-top-right animate-in fade-in-0 zoom-in-95 overflow-hidden rounded-card border border-outline-variant bg-popover p-2 shadow-floating duration-fast ease-out-soft">
          {recent.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-on-surface-variant">
              No recent activity
            </p>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between px-2 pb-1.5 pt-1">
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                  Recent requests
                </span>
                {inFlight > 0 ? (
                  <span className="text-[10.5px] font-medium text-primary">
                    {inFlight} in flight
                  </span>
                ) : null}
              </div>
              <ul className="space-y-0.5">
                {recent.slice(0, 10).map((op) => {
                  const duration =
                    op.endedAt != null ? op.endedAt - op.startedAt : null;
                  return (
                    <li
                      key={op.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs"
                    >
                      <span className="truncate font-mono text-data-mono text-on-surface">
                        {op.command}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10px] uppercase tracking-wide",
                          op.status === "active" && "text-primary",
                          op.status === "completed" && "text-on-surface-variant",
                          op.status === "error" && "text-destructive",
                        )}
                      >
                        {op.status === "active"
                          ? "…"
                          : duration != null
                            ? `${duration}ms`
                            : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

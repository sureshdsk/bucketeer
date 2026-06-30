import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Menu } from "@/components/ui/menu";
import {
  useNotificationStore,
  type NotificationKind,
} from "@/stores/useNotificationStore";
import { cn } from "@/lib/utils";

const TONE: Record<NotificationKind, string> = {
  info: "text-on-surface",
  success: "text-secondary-fixed-dim",
  warning: "text-primary",
  error: "text-destructive",
};

export function NotificationsButton() {
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clear = useNotificationStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-150 hover:bg-surface-container hover:text-on-surface"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-background" />
        ) : null}
      </button>
      {open ? (
        <Menu origin="top-right" className="absolute right-0 top-full mt-1 w-80">
          <div className="flex items-center justify-between border-b border-outline-variant/60 px-2 py-1.5">
            <span className="px-1 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant/70">
              Notifications · {items.length}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={markAllRead}
                title="Mark all as read"
                className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-150 hover:bg-surface-container hover:text-on-surface"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={clear}
                title="Clear"
                className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-150 hover:bg-surface-container hover:text-on-surface"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13px] text-on-surface-variant">
                No notifications yet.
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "border-b border-outline-variant/20 px-3 py-2 last:border-0",
                    n.read ? "opacity-60" : "",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-[13px]", TONE[n.kind])}>{n.title}</span>
                    <span className="font-mono text-[10px] text-on-surface-variant/70">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="mt-0.5 break-words font-mono text-[11px] text-on-surface-variant">
                      {n.body}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </Menu>
      ) : null}
    </div>
  );
}

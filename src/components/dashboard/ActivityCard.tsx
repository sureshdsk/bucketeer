import { ArrowDownToLine, ArrowUpFromLine, Bell } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useNotificationStore } from "@/stores/useNotificationStore";

export function ActivityCard() {
  const items = useNotificationStore((s) => s.items);
  const recent = items.slice(0, 6);

  return (
    <Card className="animate-card-enter stagger-4 flex flex-col gap-2 p-card_padding_lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-on-surface-variant/70" />
          <h2 className="text-headline-sm font-semibold tracking-tight text-on-surface">
            Recent activity
          </h2>
        </div>
        {items.length > 0 ? (
          <span className="rounded-full bg-surface-container-high px-1.5 py-px text-[9.5px] font-semibold text-on-surface-variant">
            {items.length}
          </span>
        ) : null}
      </div>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
          <span className="text-[12px] text-on-surface-variant">
            No activity yet.
          </span>
          <span className="text-[11px] text-on-surface-variant/70">
            Transfers and edits will appear here.
          </span>
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {recent.map((n) => {
            const isTransfer = /uploaded|download/i.test(n.title);
            const Icon = isTransfer
              ? /upload/i.test(n.title)
                ? ArrowUpFromLine
                : ArrowDownToLine
              : Bell;
            return (
              <li
                key={n.id}
                className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-[12px]"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-on-surface">{n.title}</div>
                  {n.body ? (
                    <div className="truncate font-mono text-data-mono text-[10.5px] text-on-surface-variant">
                      {n.body}
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-data-mono text-[10px] text-on-surface-variant/70">
                  {new Date(n.createdAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

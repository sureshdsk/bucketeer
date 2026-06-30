import { Command, Plus, Search } from "lucide-react";

import { Card } from "@/components/ui/card";

export interface QuickAction {
  icon: typeof Command;
  label: string;
  hint?: string;
  onClick?: () => void;
}

export function QuickActionsCard({
  actions,
  onAddBucket,
  onOpenPalette,
}: {
  actions?: QuickAction[];
  onAddBucket?: () => void;
  onOpenPalette?: () => void;
}) {
  const defaults: QuickAction[] = actions ?? [
    {
      icon: Search,
      label: "Open command palette",
      hint: "⌘K",
      onClick: onOpenPalette,
    },
    {
      icon: Plus,
      label: "Add a new bucket",
      onClick: onAddBucket,
    },
    {
      icon: Command,
      label: "Browse all buckets",
      hint: "Sidebar",
    },
  ];

  return (
    <Card className="animate-card-enter stagger-3 flex flex-col gap-2 p-card_padding_lg">
      <div className="flex items-center gap-2">
        <Command className="h-4 w-4 text-on-surface-variant/70" />
        <h2 className="text-headline-sm font-semibold tracking-tight text-on-surface">
          Quick actions
        </h2>
      </div>
      <ul className="flex flex-col gap-1">
        {defaults.map((action, i) => {
          const Icon = action.icon;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={action.onClick}
                className="card-hover flex w-full items-center gap-2.5 rounded-md border border-transparent bg-surface-container-low/40 px-2.5 py-2 text-left text-[13px] text-on-surface transition-colors hover:border-outline-variant/60 hover:bg-card"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                <span className="flex-1 truncate">{action.label}</span>
                {action.hint ? (
                  <kbd className="rounded bg-surface-container-high px-1.5 font-mono text-[10px] text-on-surface-variant">
                    {action.hint}
                  </kbd>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

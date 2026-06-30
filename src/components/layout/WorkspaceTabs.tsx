import { Plus, X } from "lucide-react";

import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useBucketStore } from "@/stores/useBucketStore";
import { cn } from "@/lib/utils";

export function WorkspaceTabs() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeId = useWorkspaceStore((s) => s.activeTabId);
  const activate = useWorkspaceStore((s) => s.activate);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const newTab = useWorkspaceStore((s) => s.newTab);
  const activeBucket = useBucketStore((s) => s.active);

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            className={cn(
              "group flex h-8 cursor-pointer items-center gap-2 rounded-card-top border border-b-0 px-3 text-xs transition-[background-color,border-color,box-shadow] duration-base ease-out-soft",
              active
                ? "-mb-px border-outline-variant/60 bg-card pb-px shadow-[0_-1px_3px_-1px_rgba(0,0,0,0.06)]"
                : "border-transparent bg-transparent text-on-surface-variant hover:bg-surface-container/70 hover:text-on-surface",
            )}
            style={{ borderTopLeftRadius: "var(--radius-card)", borderTopRightRadius: "var(--radius-card)" }}
            onClick={() => activate(tab.id)}
          >
            {active ? (
              <span className="h-3 w-[2px] rounded-full bg-primary" aria-hidden />
            ) : null}
            <span className="max-w-[180px] truncate font-mono text-data-mono">{tab.label}</span>
            <button
              type="button"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded text-on-surface-variant opacity-0 transition-opacity duration-instant hover:bg-surface-container hover:text-on-surface group-hover:opacity-60",
                tabs.length === 1 ? "hidden" : "",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        aria-label="New workspace tab"
        title="New workspace tab"
        disabled={!activeBucket}
        onClick={() => activeBucket && newTab(activeBucket)}
        className="flex h-8 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

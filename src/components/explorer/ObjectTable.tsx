import { ChevronRight, FileText, Folder } from "lucide-react";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Badge } from "@/components/ui/badge";
import type { ObjectMeta } from "@/lib/ipc";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export interface ObjectTableProps {
  items: ObjectMeta[];
  selectedKey: string | null;
  multiSelect: Record<string, ObjectMeta>;
  onOpenFolder: (key: string) => void;
  onSelect: (meta: ObjectMeta) => void;
  onToggleMulti: (meta: ObjectMeta) => void;
  onToggleAll: () => void;
  onContextMenu: (meta: ObjectMeta, x: number, y: number) => void;
  status: "idle" | "loading" | "ready" | "error";
  nextCursor: string | null;
  onLoadMore: () => void;
}

const ROW_HEIGHT = 40;

export function ObjectTable({
  items,
  selectedKey,
  multiSelect,
  onOpenFolder,
  onSelect,
  onToggleMulti,
  onToggleAll,
  onContextMenu,
  status,
  nextCursor,
  onLoadMore,
}: ObjectTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });
  const allSelected = items.length > 0 && items.every((m) => multiSelect[m.key]);
  const someSelected = items.some((m) => multiSelect[m.key]) && !allSelected;

  const totalHeight = rowVirtualizer.getTotalSize();
  const visibleItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-outline-variant/60 bg-surface-container-low/60 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        <div className="w-10 px-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={onToggleAll}
            aria-label="Select all"
            className="h-3.5 w-3.5 accent-primary"
          />
        </div>
        <div className="flex-1 px-2 text-left">Name</div>
        <div className="w-28 px-2 text-right">Size</div>
        <div className="w-44 px-2 text-left">Modified</div>
        <div className="w-32 px-2 text-left">Class</div>
      </div>

      <div ref={parentRef} className="relative min-h-0 flex-1 overflow-auto">
        {items.length === 0 ? null : (
          <div
            className="relative w-full animate-fade-content"
            style={{ height: `${totalHeight}px` }}
          >
            {visibleItems.map((virtualItem) => {
              const item = items[virtualItem.index];
              if (!item) return null;
              const isSelected = item.key === selectedKey;
              const isMulti = !!multiSelect[item.key];
              return (
                <div
                  key={item.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() =>
                    item.is_dir ? onOpenFolder(item.key) : onSelect(item)
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu(item, e.clientX, e.clientY);
                  }}
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className={cn(
                    "group absolute inset-x-0 flex cursor-pointer items-center border-b border-outline-variant/15 transition-[background-color,box-shadow] duration-instant",
                    isMulti
                      ? "bg-primary/12 shadow-[inset_2px_0_0_0_var(--primary)]"
                      : isSelected
                        ? "bg-primary/8 shadow-[inset_2px_0_0_0_var(--primary)]"
                        : "hover:bg-surface-container-low/80",
                  )}
                >
                  <div className="flex h-table_row w-10 items-center px-3">
                    <input
                      type="checkbox"
                      checked={isMulti}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleMulti(item)}
                      aria-label={`Select ${item.key}`}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                  </div>
                  <div className="flex flex-1 items-center gap-2 px-2">
                    {item.is_dir ? (
                      <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-on-surface-variant/50" />
                    )}
                    <span className="truncate font-mono text-data-mono text-on-surface">
                      {displayName(item.key)}
                    </span>
                  </div>
                  <div className="w-28 px-2 text-right font-mono text-data-mono tabular-nums text-on-surface-variant">
                    {item.is_dir ? "—" : formatBytes(item.size)}
                  </div>
                  <div className="w-44 px-2 font-mono text-data-mono text-on-surface-variant/80">
                    {formatDate(item.last_modified)}
                  </div>
                  <div className="w-32 px-2">
                    {item.is_dir ? (
                      <span />
                    ) : (
                      <Badge variant={item.storage_class ? "outline" : "private"}>
                        {item.storage_class ?? "STANDARD"}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {nextCursor !== null ? (
        <div className="flex shrink-0 items-center justify-center border-t border-outline-variant/60 bg-surface-container-low/40 p-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={status === "loading"}
            className="flex items-center gap-1.5 rounded-pill border border-outline-variant/70 bg-card px-3 py-1.5 text-xs font-medium text-on-surface transition-colors duration-instant hover:border-outline hover:bg-surface-container disabled:opacity-50"
          >
            Load more <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function displayName(key: string): string {
  const trimmed = key.replace(/\/$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

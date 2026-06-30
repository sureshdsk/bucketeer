import { ArrowDownUp, Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { Select } from "@/components/ui/select";
import { prefetchPrefix } from "@/lib/ipc";
import { useExplorerStore } from "@/stores/useExplorerStore";
import { cn } from "@/lib/utils";

export type SortKey = "name" | "size" | "modified";
export type SortDir = "asc" | "desc";
export type TypeFilter = "all" | "folder" | "file";

export interface ToolbarProps {
  query: string;
  setQuery: (value: string) => void;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  sortDir: SortDir;
  toggleSortDir: () => void;
  typeFilter: TypeFilter;
  setTypeFilter: (value: TypeFilter) => void;
  total: number;
  filtered: number;
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "folder", label: "Folders" },
  { value: "file", label: "Files" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "modified", label: "Modified" },
];

export function Toolbar(props: ToolbarProps) {
  const bucketId = useExplorerStore((s) => s.bucketId);
  const bucket = useExplorerStore((s) => s.bucket);
  const prefix = useExplorerStore((s) => s.prefix);

  const debouncedPrefetch = useRef<number | null>(null);

  useEffect(() => {
    if (debouncedPrefetch.current) {
      window.clearTimeout(debouncedPrefetch.current);
    }
    if (!bucketId || !bucket) return;
    debouncedPrefetch.current = window.setTimeout(() => {
      void prefetchPrefix(bucketId, bucket).catch(() => {});
    }, 150);
    return () => {
      if (debouncedPrefetch.current) {
        window.clearTimeout(debouncedPrefetch.current);
      }
    };
  }, [bucketId, bucket, prefix]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[14rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant/70" />
        <input
          value={props.query}
          onChange={(e) => props.setQuery(e.target.value)}
          placeholder="Filter current view…"
          className="h-9 w-full rounded-pill border border-outline-variant/70 bg-card pl-9 pr-3 text-[13px] text-on-surface placeholder:text-on-surface-variant/60 transition-colors duration-fast focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <Select
        value={props.typeFilter}
        onValueChange={props.setTypeFilter}
        options={TYPE_OPTIONS}
        aria-label="Filter by type"
        triggerClassName="min-w-[8rem]"
      />

      <div className="flex items-center gap-1">
        <Select
          value={props.sortKey}
          onValueChange={props.setSortKey}
          options={SORT_OPTIONS}
          aria-label="Sort by"
          triggerClassName="min-w-[7rem]"
        />
        <button
          type="button"
          onClick={props.toggleSortDir}
          title={props.sortDir === "asc" ? "Ascending" : "Descending"}
          aria-label={props.sortDir === "asc" ? "Sort ascending" : "Sort descending"}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant/70 bg-card text-on-surface-variant transition-colors duration-instant hover:border-outline hover:text-on-surface"
        >
          <ArrowDownUp
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-fast",
              props.sortDir === "desc" && "scale-y-[-1]",
            )}
          />
        </button>
      </div>

      <div className="ml-auto whitespace-nowrap rounded-full bg-surface-container-low/60 px-2.5 py-1 text-[11px] tabular-nums text-on-surface-variant">
        {props.filtered}/{props.total}
      </div>
    </div>
  );
}

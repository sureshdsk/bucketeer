import { Download, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ObjectMeta } from "@/lib/ipc";
import { formatBytes } from "@/lib/utils";

export interface BulkActionBarProps {
  selected: ObjectMeta[];
  onClear: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  selected,
  onClear,
  onDownload,
  onDelete,
}: BulkActionBarProps) {
  if (selected.length === 0) return null;
  const totalBytes = selected.reduce((acc, m) => acc + m.size, 0);
  const folderCount = selected.filter((m) => m.is_dir).length;
  const fileCount = selected.length - folderCount;

  return (
    <div className="absolute inset-x-3 top-3 z-20 flex animate-in fade-in-0 slide-in-from-top-2 items-center justify-between gap-3 rounded-full border border-outline-variant/60 bg-popover px-3 py-1.5 shadow-floating duration-base ease-emphasized">
      <div className="flex items-center gap-3 pl-1">
        <span className="text-[13px] font-semibold text-on-surface">
          <span className="text-primary">{selected.length}</span> selected
        </span>
        <span className="h-3 w-px bg-outline-variant" />
        <span className="text-[11px] text-on-surface-variant">
          {fileCount > 0 ? `${fileCount} files` : null}{" "}
          {folderCount > 0 ? `· ${folderCount} folders` : null}
          {totalBytes > 0 ? `· ${formatBytes(totalBytes)}` : null}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
        <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1.5 rounded-full">
          <Trash2 className="h-3.5 w-3.5" />
          Delete {selected.length}
        </Button>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

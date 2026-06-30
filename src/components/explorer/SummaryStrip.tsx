import { Clock, FileText, Folder, HardDrive } from "lucide-react";
import { useMemo } from "react";

import type { ObjectMeta } from "@/lib/ipc";
import { cn, formatBytes, formatDate } from "@/lib/utils";

interface SummaryStripProps {
  items: ObjectMeta[];
  className?: string;
}

export function SummaryStrip({ items, className }: SummaryStripProps) {
  const stats = useMemo(() => {
    const files = items.filter((i) => !i.is_dir);
    const folders = items.filter((i) => i.is_dir);
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const latestModified = files.reduce(
      (max, f) =>
        f.last_modified && f.last_modified > max ? f.last_modified : max,
      0,
    );
    return {
      files: files.length,
      folders: folders.length,
      totalBytes,
      latestModified,
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline-variant/60 bg-surface-container-low/40 px-card_padding py-1.5",
        className,
      )}
    >
      <Stat icon={FileText} value={`${stats.files}`} label="objects" />
      {stats.folders > 0 ? (
        <Stat icon={Folder} value={`${stats.folders}`} label="folders" />
      ) : null}
      <Divider />
      <Stat
        icon={HardDrive}
        value={formatBytes(stats.totalBytes)}
        mono
        label="size"
      />
      <Divider />
      <Stat
        icon={Clock}
        value={stats.latestModified ? formatDate(stats.latestModified) : "—"}
        mono
        label="modified"
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  mono = false,
}: {
  icon: typeof FileText;
  value: string;
  label: string;
  mono?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap" title={`${label}: ${value}`}>
      <Icon className="h-3 w-3 shrink-0 text-on-surface-variant/60" />
      <span
        className={cn(
          "text-[11px] font-medium text-on-surface",
          mono && "font-mono text-data-mono",
        )}
      >
        {value}
      </span>
      <span className="text-[10.5px] text-on-surface-variant/60">{label}</span>
    </span>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-outline-variant/60" aria-hidden />;
}

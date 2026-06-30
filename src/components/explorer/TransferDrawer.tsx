import {
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  XCircle,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTransferStore, type TransferRow } from "@/stores/useTransferStore";
import { cn, formatBytes } from "@/lib/utils";
import type { TransferKind, TransferPhase } from "@/lib/ipc";

const PHASE_META: Record<TransferPhase, { label: string; tone: string }> = {
  queued: { label: "Queued", tone: "text-on-surface-variant" },
  starting: { label: "Starting", tone: "text-primary" },
  active: { label: "Active", tone: "text-primary" },
  completed: { label: "Completed", tone: "text-secondary-fixed-dim" },
  failed: { label: "Failed", tone: "text-destructive" },
  cancelled: { label: "Cancelled", tone: "text-on-surface-variant" },
};

export function TransferDrawer() {
  const drawerOpen = useTransferStore((s) => s.drawerOpen);
  const setDrawerOpen = useTransferStore((s) => s.setDrawerOpen);
  const transfers = useTransferStore((s) => s.transfers);
  const cancel = useTransferStore((s) => s.cancel);
  const clearCompleted = useTransferStore((s) => s.clearCompleted);

  const rows = Object.values(transfers).sort(
    (a, b) => b.startedAt - a.startedAt,
  );
  const active = rows.filter(
    (r) => r.phase !== "completed" && r.phase !== "failed" && r.phase !== "cancelled",
  );
  const done = rows.filter(
    (r) => r.phase === "completed" || r.phase === "failed" || r.phase === "cancelled",
  );

  return (
    <aside
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 flex max-h-80 flex-col border-t border-outline-variant/60 bg-popover shadow-floating transition-transform duration-base ease-emphasized",
        drawerOpen ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-outline-variant/60 px-card_padding">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Transfers
          </span>
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {active.length} active
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={clearCompleted}>
            Clear done
          </Button>
          <button
            type="button"
            aria-label="Close transfers"
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-card_padding">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
            <Upload className="h-5 w-5 text-on-surface-variant/50" />
            <p className="text-[12px] text-on-surface-variant">
              No transfers yet. Drag files onto the table or use Upload.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {active.length > 0 ? (
              <TransferSection
                title="Active"
                rows={active}
                onCancel={cancel}
              />
            ) : null}
            {done.length > 0 ? (
              <TransferSection
                title="Completed"
                rows={done}
                onCancel={cancel}
              />
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function TransferSection({
  title,
  rows,
  onCancel,
}: {
  title: string;
  rows: TransferRow[];
  onCancel: (id: string, kind: TransferKind) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-1 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <TransferRowItem key={row.id} row={row} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}

function TransferRowItem({
  row,
  onCancel,
}: {
  row: TransferRow;
  onCancel: (id: string, kind: TransferKind) => Promise<void>;
}) {
  const Icon = row.kind === "upload" ? Upload : Download;
  const phase = PHASE_META[row.phase];
  const isTerminal =
    row.phase === "completed" || row.phase === "failed" || row.phase === "cancelled";
  const isWorking =
    row.phase === "active" || row.phase === "starting" || row.phase === "queued";
  const name = row.key.split("/").filter(Boolean).pop() ?? row.key;

  return (
    <Card className="flex items-center gap-3 p-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-card",
          row.phase === "failed"
            ? "bg-tint-rose text-tint-on-rose"
            : isTerminal
              ? "bg-tint-green text-tint-on-green"
              : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-data-mono text-[12px] font-medium text-on-surface">
            {name}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide",
              phase.tone,
            )}
          >
            {row.phase === "completed" ? <CheckCircle2 className="h-3 w-3" /> : null}
            {row.phase === "failed" ? <XCircle className="h-3 w-3" /> : null}
            {isWorking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span>{phase.label}</span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-base ease-out-soft",
                row.phase === "failed" ? "bg-destructive" : "bg-primary progress-shimmer",
              )}
              style={{ width: `${Math.max(2, Math.round(row.progress * 100))}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-data-mono text-[10px] tabular-nums text-on-surface-variant">
            {formatBytes(row.bytes)} / {row.total ? formatBytes(row.total) : "—"}
          </span>
        </div>
        {row.error ? (
          <div className="mt-1 truncate font-mono text-data-mono text-[10px] text-destructive">
            {row.error}
          </div>
        ) : null}
      </div>
      {isWorking ? (
        <button
          type="button"
          aria-label="Cancel"
          title="Cancel"
          onClick={() => void onCancel(row.id, row.kind)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </Card>
  );
}

export function TransferIndicator({ onToggle }: { onToggle: () => void }) {
  const count = useTransferStore((s) =>
    Object.values(s.transfers).filter(
      (t) => t.phase === "active" || t.phase === "queued" || t.phase === "starting",
    ).length,
  );
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Transfers"
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
    >
      <Upload className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute right-0.5 top-0.5 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-popover">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}

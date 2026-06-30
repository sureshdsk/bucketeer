import { ChevronDown, FileUp, FolderUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { Menu, MenuItem } from "@/components/ui/menu";
import { enqueueFolderUpload, enqueueUpload } from "@/lib/ipc";
import { useTransferStore } from "@/stores/useTransferStore";
import { useExplorerStore } from "@/stores/useExplorerStore";
import { cn } from "@/lib/utils";

export function UploadSplitButton() {
  const [open, setOpen] = useState(false);
  const bucketId = useExplorerStore((s) => s.bucketId);
  const bucket = useExplorerStore((s) => s.bucket);
  const prefix = useExplorerStore((s) => s.prefix);
  const enqueue = useTransferStore((s) => s.enqueue);
  const refresh = useExplorerStore((s) => s.refresh);

  const pickFile = useCallback(async () => {
    setOpen(false);
    if (!bucketId || !bucket) return;
    const picked = await openDialog({ multiple: false });
    if (typeof picked !== "string" || !picked) return;
    const filename = picked.split(/[\\/]/).pop() ?? picked;
    const fullKey = prefix ? `${prefix}${filename}` : filename;
    try {
      const id = await enqueueUpload({
        bucketId,
        bucket,
        key: fullKey,
        localPath: picked,
      });
      enqueue({
        id,
        kind: "upload",
        key: fullKey,
        phase: "queued",
        bytes: 0,
        total: 0,
        progress: 0,
        error: null,
      });
      void refresh();
    } catch (err) {
      console.error("enqueue upload failed", err);
    }
  }, [bucketId, bucket, prefix, enqueue, refresh]);

  const pickFolder = useCallback(async () => {
    setOpen(false);
    if (!bucketId || !bucket) return;
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== "string" || !picked) return;
    try {
      const ids = await enqueueFolderUpload({
        bucketId,
        bucket,
        prefix,
        localPath: picked,
      });
      const folderName = picked.split(/[\\/]/).pop() ?? picked;
      for (const id of ids) {
        enqueue({
          id,
          kind: "upload",
          key: `${prefix}${folderName}/…`,
          phase: "queued",
          bytes: 0,
          total: 0,
          progress: 0,
          error: null,
        });
      }
      void refresh();
    } catch (err) {
      console.error("enqueue folder upload failed", err);
    }
  }, [bucketId, bucket, prefix, enqueue, refresh]);

  return (
    <div className="relative">
      <div className="flex overflow-hidden rounded-card border border-primary/30 shadow-card-hover">
        <button
          type="button"
          onClick={() => void pickFile()}
          disabled={!bucketId || !bucket}
          className="flex items-center gap-1.5 bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors duration-instant hover:bg-primary/90 disabled:opacity-50"
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload
        </button>
        <button
          type="button"
          aria-label="Upload options"
          onClick={() => setOpen((v) => !v)}
          disabled={!bucketId || !bucket}
          className="flex items-center border-l border-primary-foreground/20 bg-primary px-2 py-2 text-primary-foreground transition-colors duration-instant hover:bg-primary/90 disabled:opacity-50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <Menu origin="top-right" className="absolute right-0 top-full mt-1 w-44">
            <MenuItem onSelect={() => void pickFile()} icon={FileUp}>
              Single File
            </MenuItem>
            <MenuItem onSelect={() => void pickFolder()} icon={FolderUp}>
              Bulk Upload (Folder)
            </MenuItem>
          </Menu>
        </>
      ) : null}
    </div>
  );
}

export function DragDropOverlay({
  active,
  onDrop,
  position,
}: {
  active: boolean;
  position: { x: number; y: number } | null;
  onDrop: (paths: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  if (!active) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute inset-3 z-40 flex animate-in fade-in-0 zoom-in-95 items-center justify-center rounded-card-lg border-2 border-dashed border-primary bg-primary/5 duration-base ease-emphasized",
      )}
      style={position ? { boxShadow: "0 0 0 2000px rgba(0,0,0,0.25)" } : undefined}
    >
      <div className="flex flex-col items-center gap-2 text-primary">
        <FolderUp className="h-8 w-8" />
        <p className="text-[13px]">Drop files or folders to upload</p>
      </div>
      <DropSink onDrop={onDrop} />
    </div>
  );
}

function DropSink({ onDrop }: { onDrop: (paths: string[]) => void }) {
  return (
    <button
      type="button"
      aria-hidden
      tabIndex={-1}
      onClick={() => onDrop([])}
      className="pointer-events-none absolute inset-0"
    />
  );
}

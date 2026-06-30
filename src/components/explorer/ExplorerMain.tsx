import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Loader2, Pin, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Breadcrumb } from "@/components/explorer/Breadcrumb";
import { BulkActionBar } from "@/components/explorer/BulkActionBar";
import { ConfirmDeleteModal } from "@/components/explorer/ConfirmDeleteModal";
import { DirectPathBar } from "@/components/explorer/DirectPathBar";
import { EditorDrawer } from "@/components/explorer/EditorDrawer";
import { RowContextMenu } from "@/components/explorer/RowContextMenu";
import { SharePresignedModal } from "@/components/explorer/SharePresignedModal";
import {
  EmptyState,
  ErrorState,
  NoBucketSelected,
  SkeletonTable,
} from "@/components/explorer/States";
import { MetadataDrawer } from "@/components/explorer/MetadataDrawer";
import { ObjectTable } from "@/components/explorer/ObjectTable";
import { SaveLocationModal } from "@/components/explorer/SaveLocationModal";
import { SummaryStrip } from "@/components/explorer/SummaryStrip";
import {
  DragDropOverlay,
  UploadSplitButton,
} from "@/components/explorer/UploadControls";
import { TransferDrawer } from "@/components/explorer/TransferDrawer";
import {
  Toolbar,
  type SortDir,
  type SortKey,
  type TypeFilter,
} from "@/components/explorer/Toolbar";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/layout/Drawer";
import { enqueueDownload, enqueueFolderUpload } from "@/lib/ipc";
import { useExplorerStore } from "@/stores/useExplorerStore";
import { useTransferStore } from "@/stores/useTransferStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import type { ObjectMeta } from "@/lib/ipc";

export function ExplorerMain() {
  const bucket = useExplorerStore((s) => s.bucket);
  const items = useExplorerStore((s) => s.items);
  const status = useExplorerStore((s) => s.status);
  const error = useExplorerStore((s) => s.error);
  const nextCursor = useExplorerStore((s) => s.nextCursor);
  const selected = useExplorerStore((s) => s.selected);
  const multiSelect = useExplorerStore((s) => s.multiSelect);
  const openFolder = useExplorerStore((s) => s.openFolder);
  const select = useExplorerStore((s) => s.select);
  const toggleMulti = useExplorerStore((s) => s.toggleMulti);
  const clearMulti = useExplorerStore((s) => s.clearMulti);
  const setMulti = useExplorerStore((s) => s.setMulti);
  const loadMore = useExplorerStore((s) => s.loadMore);
  const refresh = useExplorerStore((s) => s.refresh);
  const bucketId = useExplorerStore((s) => s.bucketId);
  const prefix = useExplorerStore((s) => s.prefix);

  const enqueueTransfer = useTransferStore((s) => s.enqueue);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    meta: ObjectMeta;
    x: number;
    y: number;
  } | null>(null);
  const [editorMeta, setEditorMeta] = useState<ObjectMeta | null>(null);
  const [shareMeta, setShareMeta] = useState<ObjectMeta | null>(null);
  const [saveLocationOpen, setSaveLocationOpen] = useState(false);
  const pushNotification = useNotificationStore((s) => s.push);

  // Subscribe once to transfer progress events.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void useTransferStore.getState().subscribe().then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Wire Tauri's OS-level drag/drop events. Files arrive as paths.
  useEffect(() => {
    const webview = getCurrentWebview();
    let unlisten: (() => void) | undefined;
    let active = false;
    void webview.onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        if (!active) {
          active = true;
          setDragActive(true);
        }
      } else if (payload.type === "leave") {
        active = false;
        setDragActive(false);
      } else if (payload.type === "drop") {
        active = false;
        setDragActive(false);
        void ingestDroppedPaths(payload.paths);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketId, bucket, prefix]);

  const ingestDroppedPaths = async (paths: string[]) => {
    if (!bucketId || !bucket || paths.length === 0) return;
    for (const p of paths) {
      try {
        // `enqueue_folder_upload` is smart enough to handle either a file or a
        // directory on the Rust side; we mirror each returned transfer id into
        // the transfer drawer.
        const ids = await enqueueFolderUpload({
          bucketId,
          bucket,
          prefix,
          localPath: p,
        });
        const label = p.split(/[\\/]/).pop() ?? p;
        for (const id of ids) {
          enqueueTransfer({
            id,
            kind: "upload",
            key: `${prefix}${label}${ids.length > 1 ? "/…" : ""}`,
            phase: "queued",
            bytes: 0,
            total: 0,
            progress: 0,
            error: null,
          });
        }
      } catch (err) {
        console.error("ingest drag drop failed", p, err);
      }
    }
    void refresh();
  };

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((m) => m.key.toLowerCase().includes(q));
    if (typeFilter !== "all") {
      list = list.filter((m) => (typeFilter === "folder" ? m.is_dir : !m.is_dir));
    }
    const sorted = [...list].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const dir = sortDir === "asc" ? 1 : -1;
      let cmp = 0;
      if (sortKey === "name") cmp = displayName(a.key).localeCompare(displayName(b.key));
      else if (sortKey === "size") cmp = a.size - b.size;
      else cmp = (a.last_modified ?? 0) - (b.last_modified ?? 0);
      return cmp * dir;
    });
    return sorted;
  }, [items, query, typeFilter, sortKey, sortDir]);

  const handleSelect = (meta: ObjectMeta) => {
    select(meta);
    setDrawerOpen(true);
  };

  const handleToggleAll = () => {
    const allInView = view.length > 0 && view.every((m) => multiSelect[m.key]);
    if (allInView) {
      clearMulti();
    } else {
      setMulti(view);
    }
  };

  const multiList = useMemo(() => Object.values(multiSelect), [multiSelect]);

  const onDownloadSelected = async () => {
    if (!bucketId || !bucket) return;
    for (const m of multiList) {
      if (m.is_dir) continue;
      try {
        const id = await enqueueDownload({ bucketId, bucket, key: m.key });
        enqueueTransfer({
          id,
          kind: "download",
          key: m.key,
          phase: "queued",
          bytes: 0,
          total: 0,
          progress: 0,
          error: null,
        });
      } catch (err) {
        console.error("enqueue download failed", err);
      }
    }
  };

  const lastRefresh = useRef(0);
  useEffect(() => {
    // After a confirmed delete, the store invalidates the affected prefix; wait
    // a tick for the re-fetch then refresh the local view.
    const since = Date.now() - lastRefresh.current;
    if (since > 250) {
      lastRefresh.current = Date.now();
    }
  }, [items]);

  return (
    <div className="relative flex h-full flex-col">
      <BulkActionBar
        selected={multiList}
        onClear={clearMulti}
        onDownload={() => void onDownloadSelected()}
        onDelete={() => setConfirmDelete(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <Card className="flex flex-col gap-3 p-card_padding_lg shadow-card">
          <div className="flex items-center justify-between gap-2">
            <Breadcrumb />
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={!bucket || status === "loading"}
                title="Refresh listing"
                aria-label="Refresh listing"
                className="flex h-9 w-9 items-center justify-center rounded-pill border border-outline-variant/70 bg-card text-on-surface-variant transition-colors duration-instant hover:border-outline hover:text-on-surface disabled:opacity-40"
              >
                {status === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 transition-transform duration-fast" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSaveLocationOpen(true)}
                disabled={!bucket}
                title="Save current location"
                className="flex h-9 w-9 items-center justify-center rounded-pill border border-outline-variant/70 bg-card text-on-surface-variant transition-colors duration-instant hover:border-outline hover:text-on-surface disabled:opacity-40"
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
              <DirectPathBar />
              <UploadSplitButton />
            </div>
          </div>
          <Toolbar
            query={query}
            setQuery={setQuery}
            sortKey={sortKey}
            setSortKey={setSortKey}
            sortDir={sortDir}
            toggleSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            total={items.length}
            filtered={view.length}
          />
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="relative min-h-0 flex-1">
            {!bucket ? (
              <NoBucketSelected />
            ) : status === "loading" && items.length === 0 ? (
              <SkeletonTable />
            ) : status === "error" ? (
              <ErrorState message={error ?? "Failed to list objects."} onRetry={() => void refresh()} />
            ) : items.length === 0 ? (
              <EmptyState message="This folder is empty. Drop files here to upload." />
            ) : (
              <ObjectTable
                items={view}
                selectedKey={selected?.key ?? null}
                multiSelect={multiSelect}
                onOpenFolder={(key) => void openFolder(key)}
                onSelect={handleSelect}
                onToggleMulti={toggleMulti}
                onToggleAll={handleToggleAll}
                onContextMenu={(meta, x, y) => setContextMenu({ meta, x, y })}
                status={status}
                nextCursor={nextCursor}
                onLoadMore={() => void loadMore()}
              />
            )}
          </div>
          {bucket && items.length > 0 && status !== "loading" ? (
            <SummaryStrip items={items} />
          ) : null}
        </Card>
      </div>

      <DragDropOverlay active={dragActive} onDrop={() => {}} position={null} />

      <TransferDrawer />

      <Drawer
        open={drawerOpen && selected !== null}
        onClose={() => setDrawerOpen(false)}
        title="Object Details"
      >
        <MetadataDrawer
          meta={selected}
          bucketId={bucketId}
          bucket={bucket}
          onEdit={(m) => setEditorMeta(m)}
          onShare={(m) => setShareMeta(m)}
        />
      </Drawer>

      <Drawer
        open={editorMeta !== null}
        onClose={() => setEditorMeta(null)}
        title="Edit object"
        expandable
      >
        <EditorDrawer
          meta={editorMeta}
          bucketId={bucketId}
          bucket={bucket}
          onClose={() => setEditorMeta(null)}
        />
      </Drawer>

      <SharePresignedModal
        open={shareMeta !== null}
        onClose={() => setShareMeta(null)}
        bucketId={bucketId}
        bucket={bucket}
        key={shareMeta?.key ?? null}
      />

      <RowContextMenu
        meta={contextMenu?.meta ?? null}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={() => setContextMenu(null)}
        onCopyKey={(m) => {
          void navigator.clipboard.writeText(m.key);
          pushNotification({ kind: "info", title: "Copied key", body: m.key });
        }}
        onCopyS3Uri={(m) => {
          const uri = `s3://${bucket ?? ""}/${m.key}`;
          void navigator.clipboard.writeText(uri);
          pushNotification({ kind: "info", title: "Copied S3 URI", body: uri });
        }}
        onDownload={(m) => {
          if (!bucketId || !bucket) return;
          void enqueueDownload({ bucketId, bucket, key: m.key }).then((id) => {
            enqueueTransfer({
              id,
              kind: "download",
              key: m.key,
              phase: "queued",
              bytes: 0,
              total: 0,
              progress: 0,
              error: null,
            });
          });
        }}
        onShare={(m) => setShareMeta(m)}
        onEdit={(m) => setEditorMeta(m)}
        onInspect={(m) => setEditorMeta(m)}
        onDelete={(m) => {
          clearMulti();
          toggleMulti(m);
          setConfirmDelete(true);
        }}
      />

      <ConfirmDeleteModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        bucketId={bucketId}
        bucket={bucket}
        objects={multiList}
        onDeleted={() => {
          clearMulti();
          void refresh();
        }}
      />

      <SaveLocationModal open={saveLocationOpen} onClose={() => setSaveLocationOpen(false)} />
    </div>
  );
}

function displayName(key: string): string {
  const trimmed = key.replace(/\/$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

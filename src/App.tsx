import { listen } from "@tauri-apps/api/event";
import { Cloud } from "lucide-react";
import { useEffect, useState } from "react";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { ExplorerMain } from "@/components/explorer/ExplorerMain";
import { BucketFormModal } from "@/components/buckets/BucketFormModal";
import { BucketManagerModal } from "@/components/buckets/BucketManagerModal";
import { BucketPicker } from "@/components/buckets/BucketPicker";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { TelemetryConsentGate } from "@/components/settings/TelemetryConsentGate";
import {
  deleteBucket,
  TRANSFER_CHANNEL,
  type Bucket,
  type TransferProgress,
} from "@/lib/ipc";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useExplorerStore } from "@/stores/useExplorerStore";
import { useLocationsStore } from "@/stores/useLocationsStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useBucketStore } from "@/stores/useBucketStore";
import { useSearchStore } from "@/stores/useSearchStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useTransferStore } from "@/stores/useTransferStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function App() {
  const buckets = useBucketStore((s) => s.buckets);
  const active = useBucketStore((s) => s.active);
  const status = useBucketStore((s) => s.status);
  const error = useBucketStore((s) => s.error);
  const refresh = useBucketStore((s) => s.refresh);

  const tabs = useWorkspaceStore((s) => s.tabs);
  const newTab = useWorkspaceStore((s) => s.newTab);
  const pushNotification = useNotificationStore((s) => s.push);
  const initTheme = useThemeStore((s) => s.init);
  const explorerBucket = useExplorerStore((s) => s.bucket);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bucket | null>(null);
  const [deleting, setDeleting] = useState<Bucket | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => initTheme(), [initTheme]);

  useEffect(() => {
    void useSettingsStore.getState().load().then(() => {
      useSettingsStore.getState().track("app", "launch");
    });
  }, []);

  // Boot: load buckets, then auto-create the first workspace tab.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void useLocationsStore.getState().load();
  }, []);

  useEffect(() => {
    if (status === "ready" && !active && buckets.length > 0) {
      setPickerOpen(true);
    }
  }, [status, active, buckets.length]);

  // Keep the explorer's active bucket id in sync with the selected bucket.
  // This only sets the id — it deliberately does NOT reset the bucket or items,
  // so it can never race an in-progress `openTarget` navigation.
  useEffect(() => {
    if (active) useExplorerStore.getState().setActiveBucket(active.id);
  }, [active?.id]);

  // Auto-create the first workspace tab once a bucket is selected.
  useEffect(() => {
    if (active && tabs.length === 0) {
      newTab(active);
    }
  }, [active?.id, tabs.length, newTab]);

  // Subscribe to transfer events so we can also surface terminal transfers as
  // notifications (P3.8).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<TransferProgress>(TRANSFER_CHANNEL, (event) => {
      const p = event.payload;
      if (p.phase === "completed") {
        pushNotification({
          kind: "success",
          title: `${p.kind === "upload" ? "Uploaded" : "Downloaded"} ${shortName(p.key)}`,
          body: p.key,
        });
      } else if (p.phase === "failed") {
        pushNotification({
          kind: "error",
          title: `${p.kind === "upload" ? "Upload" : "Download"} failed`,
          body: p.error ?? p.key,
        });
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [pushNotification]);

  // Subscribe to deep-search events once on boot (P3.4 wiring).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void useSearchStore.getState().subscribe().then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Subscribe to transfer store for drawer state.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void useTransferStore.getState().subscribe().then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (b: Bucket) => {
    setEditing(b);
    setFormOpen(true);
  };

  const rawId = (b: Bucket) =>
    b.source === "buckets_toml" ? b.id.replace(/^toml:/, "") : b.id;

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    const wasActive = active?.id === target.id;
    try {
      await deleteBucket(rawId(target));
      await refresh();
      if (wasActive) useExplorerStore.getState().resetView();
    } catch {
      // keep the dialog open so the error is visible via the manager
    } finally {
      setDeleting(null);
    }
  };

  if (status === "idle" || status === "loading") {
    return <Splash message="Loading buckets…" />;
  }

  if (status === "error") {
    return (
      <Centered>
        <div className="flex animate-fade-content flex-col items-center gap-4">
          <p className="text-[13px] text-on-surface-variant">
            {error ?? "Failed to load buckets."}
          </p>
          <Button onClick={() => void refresh()}>Retry</Button>
        </div>
      </Centered>
    );
  }

  if (buckets.length === 0) {
    return (
      <Centered>
        <div className="flex max-w-md animate-fade-content flex-col items-center gap-3 text-center">
          <p className="text-headline-lg font-semibold text-on-surface">
            No buckets configured
          </p>
          <p className="text-[13px] text-on-surface-variant">
            Add an S3-compatible bucket (AWS S3, DigitalOcean Spaces,
            Cloudflare R2, etc.) with the form below.
          </p>
          <Button onClick={openAdd}>Add bucket</Button>
        </div>
        <BucketFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={() => void refresh()}
          initial={null}
        />
      </Centered>
    );
  }

  return (
    <>
      <AppLayout
        onOpenPicker={() => setPickerOpen(true)}
        onAddBucket={openAdd}
        onEditBucket={openEdit}
        onDeleteBucket={setDeleting}
        onManageBuckets={() => setManagerOpen(true)}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {explorerBucket ? (
          <ExplorerMain />
        ) : (
          <Dashboard
            onAddBucket={openAdd}
            onEditBucket={openEdit}
            onDeleteBucket={setDeleting}
            onManageBuckets={() => setManagerOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}
      </AppLayout>
      <BucketPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      <BucketManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onSaved={() => void refresh()}
      />
      <BucketFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void refresh()}
        initial={editing}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TelemetryConsentGate />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete bucket"
        description="This removes the saved connection and its keyring credentials. The remote S3 bucket is not deleted."
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-on-surface-variant">
            Remove <span className="font-mono text-data-mono text-on-surface">{deleting?.name}</span>
            {deleting?.bucket ? (
              <>
                {" "}
                (<span className="font-mono text-data-mono">s3://{deleting.bucket}</span>)
              </>
            ) : null}
            ?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Splash({ message }: { message: string }) {
  return (
    <Centered>
      <div className="flex animate-fade-content flex-col items-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-card bg-primary/10 ring-1 ring-primary/20">
          <Cloud className="h-6 w-6 text-primary" />
          <span className="absolute inset-0 rounded-card border border-primary/30 animate-ping" />
        </div>
        <p className="text-[13px] text-on-surface-variant">{message}</p>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </div>
  );
}

function shortName(key: string): string {
  const trimmed = key.replace(/\/$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

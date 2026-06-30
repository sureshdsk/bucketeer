import { Cloud, Database, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { BucketFormModal } from "@/components/buckets/BucketFormModal";
import { deleteBucket, type Bucket } from "@/lib/ipc";
import { useBucketStore } from "@/stores/useBucketStore";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<string, string> = {
  aws_s3: "AWS S3",
  digitalocean_spaces: "DigitalOcean Spaces",
  cloudflare_r2: "Cloudflare R2",
  custom: "Custom S3",
};

export interface BucketManagerModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Full bucket lifecycle surface: list, edit, delete, add. */
export function BucketManagerModal({ open, onClose, onSaved }: BucketManagerModalProps) {
  const buckets = useBucketStore((s) => s.buckets);
  const refreshStore = useBucketStore((s) => s.refresh);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bucket | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await refreshStore();
    onSaved();
  };

  const startAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const startEdit = (p: Bucket) => {
    setEditing(p);
    setFormOpen(true);
  };

  const doDelete = async (p: Bucket) => {
    const rawId = p.source === "buckets_toml" ? p.id.replace(/^toml:/, "") : p.id;
    setBusy(true);
    try {
      await deleteBucket(rawId);
      await refresh();
      setConfirmId(null);
    } catch {
      // surface inline via the manager staying open
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buckets"
      description="Saved connections to S3-compatible buckets."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {buckets.length} configured
          </span>
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-1.5 rounded-pill border border-outline-variant/70 bg-card px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition-colors duration-instant hover:border-outline hover:bg-surface-container-low hover:text-on-surface"
          >
            <Plus className="h-3.5 w-3.5" /> Add bucket
          </button>
        </div>

        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {buckets.map((p) => {
            const Icon = p.provider === "aws_s3" ? Cloud : Database;
            const confirming = confirmId === p.id;
            return (
              <li
                key={p.id}
                className="card-hover flex items-center gap-3 rounded-card border border-outline-variant/60 bg-card px-3 py-2.5 shadow-card transition-[border-color] duration-base"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-card",
                    p.has_credentials
                      ? "bg-tint-green text-tint-on-green"
                      : "bg-tint-rose text-tint-on-rose",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-on-surface">{p.name}</div>
                  <div className="truncate font-mono text-data-mono text-[10.5px] text-on-surface-variant">
                    {p.bucket ? `s3://${p.bucket}${p.prefix ? `/${p.prefix}` : ""}` : (PROVIDER_LABEL[p.provider] ?? p.provider)}
                    {p.region ? ` · ${p.region}` : ""}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    p.has_credentials
                      ? "border-transparent bg-secondary-fixed-dim/15 text-secondary-fixed-dim"
                      : "border-destructive/40 text-destructive",
                  )}
                >
                  {p.has_credentials ? "Ready" : "No creds"}
                </span>

                {confirming ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doDelete(p)}
                      className="rounded-pill bg-destructive px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground transition-opacity hover:bg-destructive/90 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-pill px-2 py-1 text-[10px] uppercase tracking-wide text-on-surface-variant hover:text-on-surface"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-label="Edit bucket"
                      title="Edit"
                      onClick={() => startEdit(p)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete bucket"
                      title="Delete"
                      onClick={() => setConfirmId(p.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {buckets.length === 0 ? (
            <li className="rounded-card border-2 border-dashed border-outline-variant/60 bg-card/40 px-3 py-8 text-center text-[13px] text-on-surface-variant">
              No buckets yet.
            </li>
          ) : null}
        </ul>
      </div>

      <BucketFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void refresh()}
        initial={editing}
      />
    </Modal>
  );
}

import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  deleteObjects,
  type DeleteOutcome,
  type ObjectMeta,
} from "@/lib/ipc";

export interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  bucketId: string | null;
  bucket: string | null;
  objects: ObjectMeta[];
  onDeleted: () => void;
}

/**
 * Confirm-delete modal that lists affected keys + recursive count. Shows
 * whether the bulk path fired or the per-object fallback was used.
 */
export function ConfirmDeleteModal({
  open,
  onClose,
  bucketId,
  bucket,
  objects,
  onDeleted,
}: ConfirmDeleteModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeleteOutcome | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      setOutcome(null);
    }
  }, [open]);

  const submit = async () => {
    if (!bucketId || !bucket) return;
    setBusy(true);
    setError(null);
    try {
      const keys = objects.map((o) => o.key);
      const result = await deleteObjects({
        bucketId,
        bucket,
        keys,
        recursive: objects.some((o) => o.is_dir),
      });
      setOutcome(result);
      if (result.errors.length === 0) {
        onDeleted();
        onClose();
      }
    } catch (err) {
      setError(stringify(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm delete"
      description="Deletions are permanent unless bucket versioning is enabled."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-card border border-destructive/30 bg-tint-rose p-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1 text-[12px] text-tint-on-rose">
            <div className="font-semibold">Deletions are permanent</div>
            <div className="mt-0.5 opacity-90">
              Unless bucket versioning is enabled, these objects cannot be recovered.
            </div>
          </div>
        </div>

        <ul className="max-h-48 overflow-y-auto rounded-card border border-outline-variant/60 bg-card p-1">
          {objects.map((o) => (
            <li
              key={o.key}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-data-mono text-on-surface hover:bg-surface-container/60"
            >
              <span className="truncate">
                <span className="text-on-surface-variant">s3://{bucket}/</span>
                {o.key}
              </span>
              {o.is_dir ? (
                <span className="ml-auto shrink-0 rounded-full bg-tint-amber px-1.5 py-0.5 text-[9px] uppercase text-tint-on-amber">
                  recursive
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {objects.length > 1 ? (
          <p className="text-[12px] text-on-surface-variant">
            {objects.length} objects will be deleted. Folders expand recursively
            server-side.
          </p>
        ) : null}

        {outcome ? (
          <div className="rounded-card border border-outline-variant/60 bg-tint-green p-3 text-[12px] text-tint-on-green">
            <div className="font-semibold">
              Deleted {outcome.deleted.length}
              {outcome.used_fallback ? " (per-object fallback)" : " (bulk)"}
            </div>
            {outcome.errors.length > 0 ? (
              <ul className="mt-1 max-h-32 overflow-y-auto text-destructive">
                {outcome.errors.map((e, i) => (
                  <li key={`${e.key}-${i}`} className="truncate font-mono">
                    {e.key}: {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-card border border-destructive/30 bg-tint-rose p-3 text-[12px] text-tint-on-rose">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={busy}>
            {busy ? "Deleting…" : `Delete ${objects.length}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function stringify(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useExplorerStore } from "@/stores/useExplorerStore";
import { useLocationsStore } from "@/stores/useLocationsStore";
import { useBucketStore } from "@/stores/useBucketStore";

export interface SaveLocationModalProps {
  open: boolean;
  onClose: () => void;
}

/** Name and pin the current `(bucket, prefix)` as a saved location. */
export function SaveLocationModal({ open, onClose }: SaveLocationModalProps) {
  const active = useBucketStore((s) => s.active);
  const bucket = useExplorerStore((s) => s.bucket);
  const prefix = useExplorerStore((s) => s.prefix);
  const save = useLocationsStore((s) => s.save);

  const defaultLabel = bucket ? `${bucket}${prefix ? "/…" : ""}` : "";
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const canSave = !!active && !!bucket;

  const submit = async () => {
    if (!active || !bucket) return;
    setBusy(true);
    try {
      await save({
        id: `loc-${Math.random().toString(36).slice(2, 9)}`,
        label: label.trim() || defaultLabel,
        provider_id: active.id,
        bucket,
        prefix,
        color: null,
        created_at: 0,
      });
      setLabel("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save location"
      description="Pin the current bucket and path for one-click access from the sidebar."
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-outline-variant/60 bg-card p-3 shadow-card">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Target
          </div>
          <div className="mt-1 break-all font-mono text-data-mono text-on-surface">
            {active ? active.name : "—"}
            <span className="text-on-surface-variant"> · </span>
            {bucket ? `s3://${bucket}/${prefix}` : "no bucket"}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-on-surface-variant/70">
            Label
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={defaultLabel}
            autoFocus
            className="h-10 rounded-md border border-outline-variant/70 bg-card px-3 text-[13px] text-on-surface transition-colors duration-fast placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !canSave}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

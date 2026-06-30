import { Cloud, Database } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { useBucketStore } from "@/stores/useBucketStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { openTarget } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const PROVIDER_LABEL: Record<string, string> = {
  aws_s3: "AWS S3",
  digitalocean_spaces: "DigitalOcean Spaces",
  cloudflare_r2: "Cloudflare R2",
  custom: "Custom S3",
};

/** Shown when there are buckets but none is active yet. */
export function BucketPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const buckets = useBucketStore((s) => s.buckets);
  const select = useBucketStore((s) => s.select);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose a bucket"
      description="Pick a saved S3-compatible bucket."
    >
      <ul className="flex flex-col gap-1.5">
        {buckets.map((p) => {
          const Icon = p.provider === "aws_s3" ? Cloud : Database;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  if (p.bucket) {
                    void openTarget(p.id, p.bucket, p.prefix ?? "");
                  } else {
                    select(p.id);
                    useWorkspaceStore.getState().updateActive({
                      bucketId: p.id,
                      bucketName: p.name,
                      bucket: null,
                      prefix: "",
                    });
                  }
                  onClose();
                }}
                className="card-hover flex w-full items-center gap-3 rounded-card border border-outline-variant/60 bg-card px-3 py-2.5 text-left shadow-card transition-[background-color,border-color,box-shadow] hover:border-outline hover:shadow-card-hover"
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
                  <div className="truncate text-[11px] text-on-surface-variant">
                    {PROVIDER_LABEL[p.provider] ?? p.provider}
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
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

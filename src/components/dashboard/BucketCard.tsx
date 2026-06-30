import type { LucideIcon } from "lucide-react";
import { Cloud, CloudOff, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Bucket } from "@/lib/ipc";

const PROVIDER_LABEL: Record<string, string> = {
  aws_s3: "AWS S3",
  digitalocean_spaces: "DigitalOcean Spaces",
  cloudflare_r2: "Cloudflare R2",
  custom: "Custom S3",
};

const PROVIDER_ICON: Record<string, LucideIcon> = {
  aws_s3: Cloud,
  digitalocean_spaces: Cloud,
  cloudflare_r2: Cloud,
  custom: CloudOff,
};

export interface BucketCardProps {
  bucket: Bucket;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  index?: number;
}

export function BucketCard({
  bucket,
  onClick,
  onEdit,
  onDelete,
  className,
  index,
}: BucketCardProps) {
  const Icon = PROVIDER_ICON[bucket.provider] ?? Cloud;
  const label = PROVIDER_LABEL[bucket.provider] ?? bucket.provider;
  return (
    <div
      className={cn(
        "card-hover group relative flex w-full flex-col gap-2.5 overflow-hidden rounded-card border border-outline-variant/60 bg-card p-card_padding text-left shadow-card hover:border-outline hover:shadow-card-hover",
        typeof index === "number" && `animate-card-enter stagger-${Math.min(index + 1, 8)}`,
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col gap-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover:bg-primary/15">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-on-surface">
              {bucket.name}
            </div>
            <div className="truncate text-[10.5px] text-on-surface-variant">
              {label}
              {bucket.region ? ` · ${bucket.region}` : ""}
            </div>
          </div>
        </div>
        {bucket.bucket ? (
          <div className="min-w-0 truncate rounded-md bg-surface-container-low/60 px-2 py-1 font-mono text-data-mono text-[11px] text-on-surface-variant">
            s3://{bucket.bucket}
            {bucket.prefix ? `/${bucket.prefix}` : ""}
          </div>
        ) : null}
      </button>
      {(onEdit || onDelete) && bucket.bucket ? (
        <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-card/80 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-instant group-hover:opacity-100">
          {onEdit ? (
            <button
              type="button"
              aria-label="Edit bucket"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              aria-label="Delete bucket"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-instant hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyBucketCard({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "card-hover flex min-h-32 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-outline-variant/60 bg-card/40 p-card_padding text-on-surface-variant transition-colors hover:border-primary/50 hover:bg-card hover:text-primary",
        className,
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Cloud className="h-4 w-4" />
      </span>
      <span className="text-[13px] font-medium">Add a bucket</span>
      <span className="text-[11px] text-on-surface-variant/80">
        Connect an S3-compatible bucket
      </span>
    </button>
  );
}

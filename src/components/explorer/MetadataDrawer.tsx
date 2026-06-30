import { Copy, Download, FileEdit, Link2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  enqueueDownload,
  headObject,
  presignGet,
  type ObjectDetails,
  type ObjectMeta,
} from "@/lib/ipc";
import { formatBytes, formatDate, s3Arn } from "@/lib/utils";
import { useTransferStore } from "@/stores/useTransferStore";

interface MetadataDrawerProps {
  meta: ObjectMeta | null;
  bucketId: string | null;
  bucket: string | null;
  onEdit?: (meta: ObjectMeta) => void;
  onShare?: (meta: ObjectMeta) => void;
}

type PreviewKind = "image" | "video" | "pdf" | "none";

export function MetadataDrawer({
  meta,
  bucketId,
  bucket,
  onEdit,
  onShare,
}: MetadataDrawerProps) {
  const [details, setDetails] = useState<ObjectDetails | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("none");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(null);
    setPreviewUrl(null);
    setPreviewKind("none");
    setError(null);
    if (!meta || meta.is_dir || !bucketId || !bucket) return;

    const ref = { bucketId, bucket, key: meta.key };
    let cancelled = false;

    (async () => {
      try {
        const fetched = await headObject(ref);
        if (cancelled) return;
        setDetails(fetched);
        const kind = classifyPreview(fetched.content_type, meta.key);
        setPreviewKind(kind);
        if (kind !== "none") {
          const url = await presignGet(ref, 900);
          if (!cancelled) setPreviewUrl(url);
        }
      } catch (err) {
        if (!cancelled) setError(stringify(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [meta, bucketId, bucket]);

  if (!meta) {
    return (
      <p className="text-[13px] text-on-surface-variant">
        Select an object to inspect its metadata.
      </p>
    );
  }

  const displayName = meta.key.split("/").filter(Boolean).pop() ?? meta.key;
  const fetching = !meta.is_dir && !!bucketId && !!bucket && !details && !error;
  const canAct = !meta.is_dir && !!bucketId && !!bucket;

  const download = () => {
    if (!bucketId || !bucket) return;
    void enqueueDownload({ bucketId, bucket, key: meta.key }).then((id) => {
      useTransferStore.getState().enqueue({
        id,
        kind: "download",
        key: meta.key,
        phase: "queued",
        bytes: 0,
        total: 0,
        progress: 0,
        error: null,
      });
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          {meta.is_dir ? "Folder" : "Object"}
        </div>
        <div className="mt-1 break-all font-mono text-data-mono text-[13px] font-semibold text-on-surface">
          {displayName}
        </div>
      </Card>

      {canAct ? (
        <div className="flex flex-col gap-2">
          <Button size="sm" className="w-full" onClick={download}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <div className="flex gap-2">
            {onEdit ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(meta)}
              >
                <FileEdit className="h-3.5 w-3.5" /> Edit
              </Button>
            ) : null}
            {onShare ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onShare(meta)}
              >
                <Link2 className="h-3.5 w-3.5" /> Share
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <Card className="border-destructive/30 bg-tint-rose p-3 text-[12px] text-tint-on-rose">
          {error}
        </Card>
      ) : null}

      {previewUrl && previewKind === "image" ? (
        <Card className="overflow-hidden p-1">
          <img
            src={previewUrl}
            alt={displayName}
            className="w-full rounded-card"
          />
        </Card>
      ) : null}
      {previewUrl && previewKind === "video" ? (
        <Card className="overflow-hidden p-1">
          <video src={previewUrl} controls className="w-full rounded-card" />
        </Card>
      ) : null}
      {previewUrl && previewKind === "pdf" ? (
        <Card className="overflow-hidden p-1">
          <iframe
            src={previewUrl}
            title={displayName}
            className="h-64 w-full rounded-card"
          />
        </Card>
      ) : null}

      {fetching ? (
        <Card className="flex items-center justify-center gap-2 p-4 text-[12px] text-on-surface-variant">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading metadata…
        </Card>
      ) : null}

      <Card className="flex flex-col gap-0 p-1">
        <Field label="S3 URI" value={`s3://${bucket}/${meta.key}`} copyable />
        <Field label="ARN" value={bucket ? s3Arn(bucket, meta.key) : "—"} copyable />
        <Field label="ETag" value={details?.etag ?? meta.etag ?? "—"} copyable />
      </Card>

      <Card className="flex flex-col gap-2 p-2.5">
        <StatRow label="Size" value={meta.is_dir ? "—" : formatBytes(meta.size)} />
        <StatRow
          label="Modified"
          value={formatDate(details?.last_modified ?? meta.last_modified)}
        />
        <StatRow label="Storage class" value={details?.storage_class ?? meta.storage_class ?? "—"} />
        <StatRow label="Content-Type" value={details?.content_type ?? "—"} />
      </Card>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          Encryption
        </div>
        <div className="flex flex-wrap gap-1.5">
          {details?.server_side_encryption ? (
            <Badge variant="encrypted">
              <ShieldCheck className="h-3 w-3" />
              {details.server_side_encryption}
            </Badge>
          ) : (
            <Badge variant="private">SSE: none</Badge>
          )}
          {details?.version_id ? (
            <Badge variant="outline">versioned</Badge>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        {label}
      </div>
      <div className="break-all font-mono text-data-mono text-[12.5px] font-medium leading-snug text-on-surface">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="group flex items-start justify-between gap-2 border-b border-outline-variant/30 px-2 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          {label}
        </div>
        <div className="mt-0.5 break-all font-mono text-data-mono text-on-surface">
          {value}
        </div>
      </div>
      {copyable ? (
        <button
          type="button"
          title="Copy"
          onClick={() => void navigator.clipboard.writeText(value)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-on-surface-variant opacity-0 transition-opacity duration-instant hover:bg-surface-container hover:text-on-surface group-hover:opacity-100"
        >
          <Copy className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function classifyPreview(contentType: string | null, key: string): PreviewKind {
  const ct = (contentType ?? "").toLowerCase();
  const ext = (key.split(".").pop() ?? "").toLowerCase();
  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return "image";
  }
  if (ct.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext)) {
    return "video";
  }
  if (ct === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  return "none";
}

function stringify(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

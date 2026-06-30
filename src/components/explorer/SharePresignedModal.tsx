import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { presignGet } from "@/lib/ipc";
import { cn } from "@/lib/utils";

export interface SharePresignedModalProps {
  open: boolean;
  onClose: () => void;
  bucketId: string | null;
  bucket: string | null;
  key: string | null;
}

const TTL_OPTIONS: { label: string; seconds: number }[] = [
  { label: "5 minutes", seconds: 5 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
];

/**
 * Right-click → Share presigned… modal (P4.3). Lets the user pick a TTL and
 * copy the URL straight to the clipboard.
 */
export function SharePresignedModal({
  open,
  onClose,
  bucketId,
  bucket,
  key,
}: SharePresignedModalProps) {
  const [ttl, setTtl] = useState(TTL_OPTIONS[0].seconds);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      setError(null);
      setCopied(false);
      setTtl(TTL_OPTIONS[0].seconds);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !bucketId || !bucket || !key) return;
    setBusy(true);
    setError(null);
    setUrl(null);
    presignGet({ bucketId, bucket, key }, ttl)
      .then((u) => setUrl(u))
      .catch((err) => setError(stringify(err)))
      .finally(() => setBusy(false));
  }, [open, bucketId, bucket, key, ttl]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("clipboard write failed", err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share presigned URL"
      description="Anyone with this link can download the object until the TTL expires."
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            TTL
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TTL_OPTIONS.map((opt) => (
              <button
                key={opt.seconds}
                type="button"
                onClick={() => setTtl(opt.seconds)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color] duration-instant",
                  ttl === opt.seconds
                    ? "border-primary/40 bg-primary/10 text-on-surface"
                    : "border-outline-variant/60 bg-card text-on-surface-variant hover:border-outline hover:text-on-surface",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Presigned URL
          </div>
          <div className="flex items-center gap-2 rounded-card border border-outline-variant/60 bg-card p-card_padding shadow-card">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
              <Link2 className="h-3.5 w-3.5" />
            </span>
            {busy ? (
              <span className="font-mono text-data-mono text-on-surface-variant">
                Generating…
              </span>
            ) : error ? (
              <span className="font-mono text-data-mono text-destructive">
                {error}
              </span>
            ) : url ? (
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full bg-transparent font-mono text-data-mono text-[11px] text-on-surface focus:outline-none"
              />
            ) : (
              <span className="font-mono text-data-mono text-on-surface-variant">
                —
              </span>
            )}
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!url}
              title="Copy to clipboard"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-secondary-fixed-dim" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void copy()} disabled={!url || busy}>
            <Share2 className="h-3.5 w-3.5" /> Copy link
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

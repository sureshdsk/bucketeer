import { BadgeCheck, Cloud, Database, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/ui/input";
import {
  saveBucket,
  verifyBucket,
  type Bucket,
  type ProviderKind,
} from "@/lib/ipc";
import { cn } from "@/lib/utils";

const PROVIDERS: {
  id: ProviderKind;
  label: string;
  defaultRegion: string;
  endpoint?: (region: string) => string;
}[] = [
  {
    id: "digitalocean_spaces",
    label: "DigitalOcean Spaces",
    defaultRegion: "nyc3",
    endpoint: (r) => `https://${r}.digitaloceanspaces.com`,
  },
  {
    id: "cloudflare_r2",
    label: "Cloudflare R2",
    defaultRegion: "auto",
    endpoint: () => `https://<account-id>.r2.cloudflarestorage.com`,
  },
  { id: "custom", label: "Custom S3", defaultRegion: "us-east-1" },
  { id: "aws_s3", label: "AWS S3 (static creds)", defaultRegion: "us-east-1" },
];

export interface BucketFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Bucket | null;
}

/**
 * Create / edit a saved bucket: a connection bundled with a specific target
 * bucket. Save runs HeadBucket first — the bucket is only persisted when it is
 * reachable with the supplied credentials. Editing with blank key fields keeps
 * the stored credentials and skips re-verification.
 */
export function BucketFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: BucketFormModalProps) {
  const editMode = !!initial;
  const [provider, setProvider] = useState<ProviderKind>("digitalocean_spaces");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("nyc3");
  const [endpoint, setEndpoint] = useState("");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      const rawId = initial.source === "buckets_toml"
        ? initial.id.replace(/^toml:/, "")
        : initial.id;
      setId(rawId);
      setName(initial.name);
      setProvider(initial.provider);
      setRegion(initial.region ?? "");
      setEndpoint(initial.endpoint_url ?? "");
      setBucket(initial.bucket ?? "");
      setPrefix(initial.prefix ?? "");
    } else {
      const p = PROVIDERS[0]!;
      setProvider(p.id);
      setRegion(p.defaultRegion);
      setEndpoint(p.endpoint ? p.endpoint(p.defaultRegion) : "");
      setId(`bucket-${p.id}-${Math.random().toString(36).slice(2, 7)}`);
      setName("");
      setBucket("");
      setPrefix("");
    }
    setAccessKey("");
    setSecretKey("");
  }, [open, initial]);

  const select = (p: (typeof PROVIDERS)[number]) => {
    if (editMode) return;
    setProvider(p.id);
    setRegion(p.defaultRegion);
    setEndpoint(p.endpoint ? p.endpoint(p.defaultRegion) : "");
    if (!name || PROVIDERS.some((pp) => pp.label === name)) {
      setName(p.label);
    }
  };

  const canVerify = !!bucket && (editMode ? true : !!accessKey && !!secretKey);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      // Verify (HeadBucket) unless we're editing and leaving the keys as-is.
      const shouldVerify = !editMode || (!!accessKey && !!secretKey);
      if (shouldVerify) {
        try {
          await verifyBucket({
            provider,
            region,
            endpointUrl: endpoint || null,
            bucket,
            accessKey,
            secretKey,
          });
        } catch (err) {
          setError(`Bucket not reachable: ${stringify(err)}`);
          return;
        }
      }
      await saveBucket({
        id,
        name: name.trim() || bucket,
        provider,
        region,
        endpointUrl: endpoint || null,
        accessKey,
        secretKey,
        bucket,
        prefix: prefix || null,
      });
      onSaved();
      onClose();
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
      title={editMode ? "Edit bucket" : "Add bucket"}
      description="A bucket bundles connection details with a specific target. It is verified with HeadBucket before saving."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Provider
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => {
              const Icon = p.id === "aws_s3" ? Cloud : Database;
              const active = p.id === provider;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  disabled={editMode}
                  className={cn(
                    "card-hover flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-left text-[13px] transition-[background-color,border-color,box-shadow] duration-base ease-out-soft",
                    active
                      ? "border-primary/40 bg-primary/10 text-on-surface shadow-card"
                      : "border-outline-variant/60 bg-card text-on-surface-variant hover:border-outline hover:bg-surface-container-low hover:text-on-surface",
                    editMode && !active && "opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-card",
                      active
                        ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/20"
                        : "bg-surface-container-high text-on-surface-variant",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Identity
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display name" hint="Optional — defaults to bucket name.">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder={bucket || "My bucket"} />
            </Field>
            <Field label="Bucket id" hint="Keyring entry name.">
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                spellCheck={false}
                disabled={editMode}
                className={cn(inputCls, "font-mono text-data-mono", editMode && "opacity-70")}
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Connection
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Region">
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                spellCheck={false}
                className={cn(inputCls, "font-mono text-data-mono")}
              />
            </Field>
            <Field label="Endpoint URL" hint="Leave blank for AWS defaults.">
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                spellCheck={false}
                placeholder="https://nyc3.digitaloceanspaces.com"
                className={cn(inputCls, "font-mono text-data-mono")}
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Location
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="Bucket name" hint="Verified before saving.">
              <input
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                spellCheck={false}
                placeholder="my-bucket"
                className={cn(inputCls, "font-mono text-data-mono")}
              />
            </Field>
            <Field label="Prefix (optional)">
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                spellCheck={false}
                placeholder="logs/"
                className={cn(inputCls, "font-mono text-data-mono")}
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Credentials
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Access key" hint={editMode ? "Blank = keep current." : undefined}>
              <input
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                spellCheck={false}
                placeholder={editMode ? "••••••" : undefined}
                className={cn(inputCls, "font-mono text-data-mono")}
              />
            </Field>
            <Field label="Secret access key" hint={editMode ? "Blank = keep current." : undefined}>
              <input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                type="password"
                spellCheck={false}
                placeholder={editMode ? "••••••" : undefined}
                className={cn(inputCls, "font-mono text-data-mono")}
              />
            </Field>
          </div>
        </div>

        {error ? (
          <div className="rounded-card border border-destructive/30 bg-tint-rose p-3 text-[12px] text-tint-on-rose">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !canVerify}>
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
              </>
            ) : (
              <>
                <BadgeCheck className="h-3.5 w-3.5" /> Verify &amp; save
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-on-surface-variant/70">
        {label}
        {hint ? <span className="ml-2 normal-case tracking-normal text-on-surface-variant/60">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function stringify(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

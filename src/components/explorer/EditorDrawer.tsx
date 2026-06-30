import { FileEdit, History, Loader2, Save, SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchForEdit,
  inspectCompressed,
  listVersions,
  restoreVersion,
  saveEdit,
  type EditorFetch,
  type InspectResult,
  type ObjectMeta,
  type ObjectVersion,
  type VersionList,
} from "@/lib/ipc";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { useThemeStore } from "@/stores/useThemeStore";

export interface EditorDrawerProps {
  meta: ObjectMeta | null;
  bucketId: string | null;
  bucket: string | null;
  onClose: () => void;
}

/**
 * Monaco-based editor + version history aside (P4.4 + P4.5). Opens when the
 * user picks "Open in editor" from the row context menu. The first 2 MiB of
 * the object is fetched into memory; saving writes it back as a new version.
 */
export function EditorDrawer({
  meta,
  bucketId,
  bucket,
}: EditorDrawerProps) {
  const resolved = useThemeStore((s) => s.resolved);
  const [doc, setDoc] = useState<EditorFetch | null>(null);
  const [edited, setEdited] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionList | null>(null);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setEdited("");
    setDirty(false);
    setError(null);
    setVersions(null);
    setInspect(null);
    setSavedNote(null);
    if (!meta || meta.is_dir || !bucketId || !bucket) return;

    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const lower = meta.key.toLowerCase();
        if (lower.endsWith(".gz") || lower.endsWith(".zstd") || lower.endsWith(".zst")) {
          const result = await inspectCompressed({
            bucketId,
            bucket,
            key: meta.key,
          });
          if (cancelled) return;
          setInspect(result);
          const text = new TextDecoder().decode(new Uint8Array(result.bytes));
          setEdited(text);
          return;
        }
        const fetched = await fetchForEdit({
          bucketId,
          bucket,
          key: meta.key,
          maxBytes: 2 * 1024 * 1024,
        });
        if (cancelled) return;
        setDoc(fetched);
        setEdited(new TextDecoder().decode(new Uint8Array(fetched.bytes)));
        if (fetched.versioned) {
          const list = await listVersions({ bucketId, bucket, key: meta.key });
          if (!cancelled) setVersions(list);
        }
      } catch (err) {
        if (!cancelled) setError(stringify(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [meta, bucketId, bucket]);

  const language = meta ? detectLanguage(meta.key) : "plaintext";

  const save = async () => {
    if (!bucketId || !bucket || !meta) return;
    setBusy(true);
    setError(null);
    setSavedNote(null);
    try {
      const bytes = Array.from(new TextEncoder().encode(edited));
      const result = await saveEdit({
        bucketId,
        bucket,
        key: meta.key,
        bytes,
        contentType: doc?.content_type ?? null,
      });
      setDirty(false);
      setSavedNote(
        result.version_id ? `Saved as version ${result.version_id}` : "Saved",
      );
      if (versions?.versioned) {
        const refreshed = await listVersions({ bucketId, bucket, key: meta.key });
        setVersions(refreshed);
      }
    } catch (err) {
      setError(stringify(err));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v: ObjectVersion) => {
    if (!bucketId || !bucket || !meta) return;
    setBusy(true);
    setError(null);
    try {
      await restoreVersion(
        { bucketId, bucket, key: meta.key },
        v.version_id,
      );
      const refreshed = await listVersions({ bucketId, bucket, key: meta.key });
      setVersions(refreshed);
    } catch (err) {
      setError(stringify(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full animate-fade-content flex-col gap-3">
      <Card className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Editor
          </div>
          <div className="mt-0.5 truncate font-mono text-data-mono text-[13px] font-medium text-on-surface">
            {meta ? shortName(meta.key) : "—"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {dirty ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              unsaved
            </span>
          ) : null}
          {doc?.versioned ? (
            <Badge variant="outline">versioned</Badge>
          ) : null}
          {inspect ? (
            <Badge variant="outline">{inspect.kind}</Badge>
          ) : null}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={busy || !dirty || !doc}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-tint-rose p-3 text-[12px] text-tint-on-rose">
          {error}
        </Card>
      ) : null}
      {savedNote ? (
        <Card className="border-secondary-fixed-dim/30 bg-tint-green p-3 text-[12px] text-tint-on-green">
          {savedNote}
        </Card>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-hidden p-0">
        <div className="h-full overflow-hidden rounded-card">
          {busy && !doc && !inspect ? (
            <div className="flex h-full items-center justify-center gap-2 text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">Loading…</span>
            </div>
          ) : (
            <Editor
              theme={resolved === "light" ? "vs" : "vs-dark"}
              language={language}
              value={edited}
              onChange={(value) => {
                setEdited(value ?? "");
                setDirty(value !== edited);
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "JetBrains Mono Variable, monospace",
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                readOnly: inspect !== null,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </Card>

      {inspect?.truncated ? (
        <Card className="border-primary/30 bg-primary/10 p-3 font-mono text-data-mono text-[11px] text-primary">
          Showing first {formatBytes(inspect.bytes.length)} of decoded output
          (range-fetched from {formatBytes(inspect.original_size)} compressed bytes).
        </Card>
      ) : null}

      {versions?.versioned ? (
        <VersionHistory
          versions={versions.versions}
          onRestore={(v) => void restore(v)}
        />
      ) : null}
    </div>
  );
}

function VersionHistory({
  versions,
  onRestore,
}: {
  versions: ObjectVersion[];
  onRestore: (v: ObjectVersion) => void;
}) {
  return (
    <Card className="flex max-h-44 shrink-0 flex-col overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-outline-variant/60 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        <History className="h-3 w-3" />
        Version history ({versions.length})
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1 p-1.5">
          {versions.map((v) => (
            <li
              key={v.version_id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-container/60",
                !v.is_latest && "opacity-70",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-data-mono text-on-surface">
                  {v.is_latest ? <FileEdit className="mr-1 inline h-3 w-3 text-primary" /> : null}
                  {v.version_id || "(null version)"}
                </div>
                <div className="font-mono text-data-mono text-[10px] text-on-surface-variant">
                  {formatDate(v.last_modified)} · {formatBytes(v.size)} ·{" "}
                  {v.etag ?? "—"}
                </div>
              </div>
              {!v.is_latest ? (
                <button
                  type="button"
                  onClick={() => onRestore(v)}
                  title="Make current"
                  className="flex items-center gap-1 rounded-pill border border-outline-variant/70 bg-card px-2 py-0.5 text-[10px] uppercase tracking-wide text-on-surface-variant transition-colors duration-instant hover:border-outline hover:bg-surface-container hover:text-on-surface"
                >
                  <SaveIcon className="h-3 w-3" />
                  Restore
                </button>
              ) : (
                <Badge variant="outline">current</Badge>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function detectLanguage(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".sh")) return "shell";
  if (lower.endsWith(".log")) return "log";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".css")) return "css";
  return "plaintext";
}

function shortName(key: string): string {
  const trimmed = key.replace(/\/$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function stringify(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

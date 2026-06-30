import { CornerDownLeft, FolderInput, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useExplorerStore } from "@/stores/useExplorerStore";

/**
 * Collapsible manual path-entry. Collapsed it's a single icon button; expanded
 * it reveals an input that accepts `bucket/a/b/` or `s3://bucket/a/b/` —
 * essential when the caller lacks `s3:ListAllMyBuckets`, but otherwise kept out
 * of the way for a clean toolbar.
 */
export function DirectPathBar() {
  const parseAndOpenPath = useExplorerStore((s) => s.parseAndOpenPath);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    if (!value.trim()) return;
    void parseAndOpenPath(value);
    setOpen(false);
    setValue("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open path directly"
        className="flex h-9 w-9 items-center justify-center rounded-pill border border-outline-variant/70 bg-card text-on-surface-variant transition-colors duration-instant hover:border-outline hover:text-on-surface"
      >
        <FolderInput className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="flex h-9 animate-in fade-in zoom-in-95 items-center gap-1 duration-fast ease-out-soft">
      <FolderInput className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setValue("");
          }
        }}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        placeholder="s3://bucket/prefix/"
        spellCheck={false}
        className="w-64 rounded-pill border border-primary bg-card px-3 py-1 font-mono text-data-mono text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        title="Open"
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface active:scale-95"
      >
        <CornerDownLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setValue("");
        }}
        aria-label="Close path bar"
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface active:scale-95"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

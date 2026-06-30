import { Pencil, Pin, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLocationsStore } from "@/stores/useLocationsStore";
import { useBucketStore } from "@/stores/useBucketStore";
import { cn } from "@/lib/utils";

export function SavedLocations() {
  const items = useLocationsStore((s) => s.items);
  const open = useLocationsStore((s) => s.open);
  const remove = useLocationsStore((s) => s.remove);
  const save = useLocationsStore((s) => s.save);
  const activeBucketId = useBucketStore((s) => s.active?.id ?? null);
  const activeBucket = useBucketStore((s) => s.active?.bucket ?? null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (items.length === 0) return null;

  const startRename = (id: string, label: string) => {
    setEditingId(id);
    setDraft(label);
  };

  const commitRename = async () => {
    const loc = items.find((l) => l.id === editingId);
    setEditingId(null);
    if (!loc) return;
    const label = draft.trim();
    if (!label || label === loc.label) return;
    await save({ ...loc, label });
  };

  return (
    <section>
      <div className="flex items-center px-1 pb-1.5">
        <Pin className="h-3 w-3 text-on-surface-variant/70" />
        <span className="ml-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          Pinned
        </span>
        {items.length > 0 ? (
          <span className="ml-1.5 rounded-full bg-surface-container-high px-1.5 py-px text-[9.5px] font-semibold text-on-surface-variant">
            {items.length}
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((loc) => {
          const isActive = loc.provider_id === activeBucketId && loc.bucket === activeBucket;
          const renaming = editingId === loc.id;
          return (
            <li key={loc.id}>
              {renaming ? (
                <RenameInput
                  value={draft}
                  setValue={setDraft}
                  onCommit={() => void commitRename()}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => void open(loc)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 rounded-card border px-2.5 py-2 text-left transition-[background-color,border-color,box-shadow] duration-base ease-out-soft",
                      isActive
                        ? "border-primary/30 bg-primary/10 shadow-sm"
                        : "border-transparent bg-transparent hover:border-outline-variant/60 hover:bg-card hover:shadow-card",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/20"
                          : "bg-surface-container-high text-on-surface-variant group-hover:text-primary",
                      )}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-on-surface">
                        {loc.label}
                      </span>
                      <span className="block truncate font-mono text-data-mono text-[10.5px] text-on-surface-variant/80">
                        s3://{loc.bucket}
                        {loc.prefix ? `/${loc.prefix}` : ""}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 transition-opacity duration-instant group-hover:opacity-100">
                    <IconButton title="Rename" onClick={() => startRename(loc.id, loc.label)}>
                      <Pencil className="h-3 w-3" />
                    </IconButton>
                    <IconButton title="Remove" danger onClick={() => void remove(loc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-instant disabled:opacity-30",
        danger
          ? "hover:bg-destructive/15 hover:text-destructive"
          : "hover:bg-surface-container hover:text-on-surface",
      )}
    >
      {children}
    </button>
  );
}

function RenameInput({
  value,
  setValue,
  onCommit,
  onCancel,
}: {
  value: string;
  setValue: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      className="m-1 h-7 rounded-md border border-primary bg-card px-2 text-[13px] text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  );
}

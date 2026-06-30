import { Command } from "cmdk";
import {
  ArrowRight,
  Cloud,
  Database,
  Pin,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  listRemoteBuckets,
  listLocations,
  type RemoteBucket,
  type StoredLocation,
} from "@/lib/ipc";
import { useBucketStore } from "@/stores/useBucketStore";
import { useExplorerStore } from "@/stores/useExplorerStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { openTarget } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Action {
  kind: "pinned" | "saved" | "remote" | "command" | "navigate";
  label: string;
  hint: string;
  icon: LucideIcon;
  active?: boolean;
  run: () => void;
}

function navKey(bucketId: string, bucket: string, prefix: string): string {
  return `${bucketId}:${bucket}:${prefix.replace(/\/$/, "")}`;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [remoteBuckets, setRemoteBuckets] = useState<RemoteBucket[]>([]);
  const [locations, setLocations] = useState<StoredLocation[]>([]);
  const buckets = useBucketStore((s) => s.buckets);
  const active = useBucketStore((s) => s.active);
  const select = useBucketStore((s) => s.select);
  const explorer = useExplorerStore();
  const newTab = useWorkspaceStore((s) => s.newTab);

  const activeBucket = useExplorerStore((s) => s.bucket);
  const activePrefix = useExplorerStore((s) => s.prefix);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (active) {
      void listRemoteBuckets(active.id)
        .then(setRemoteBuckets)
        .catch(() => setRemoteBuckets([]));
    }
    void listLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, [open, active?.id]);

  const actions = useMemo<Action[]>(() => {
    const out: Action[] = [];
    const seen = new Set<string>();

    // 1. Pinned locations — user-curated bookmarks, always shown first.
    for (const loc of locations) {
      const k = navKey(loc.provider_id, loc.bucket, loc.prefix);
      seen.add(k);
      const path = `s3://${loc.bucket}/${loc.prefix}`.replace(/\/$/, "");
      out.push({
        kind: "pinned",
        label: loc.label,
        hint: path,
        icon: Pin,
        active:
          loc.provider_id === active?.id &&
          loc.bucket === activeBucket &&
          activePrefix.startsWith(loc.prefix),
        run: () => void openTarget(loc.provider_id, loc.bucket, loc.prefix),
      });
    }

    // 2. Saved buckets — each opens its configured bucket (or switches context).
    //    Surfaced before remote discovery since they are user-curated.
    for (const p of buckets) {
      const isActive = p.id === active?.id;
      const target = p.bucket ?? null;
      if (target) seen.add(navKey(p.id, target, p.prefix ?? ""));
      out.push({
        kind: "saved",
        label: p.name,
        hint: target
          ? `s3://${target}${p.prefix ? `/${p.prefix}` : ""}`
          : (p.region ?? p.provider),
        icon: Cloud,
        active: isActive,
        run: () => {
          if (target) {
            void openTarget(p.id, target, p.prefix ?? "");
          } else {
            select(p.id);
          }
        },
      });
    }

    // 3. Buckets discovered on the remote account via ListAllMyBuckets.
    //    Skip any already surfaced as a saved bucket or pinned location.
    if (active) {
      for (const b of remoteBuckets) {
        const k = navKey(active.id, b.name, "");
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({
          kind: "remote",
          label: b.name,
          hint: "remote",
          icon: Database,
          active: b.name === activeBucket && !activePrefix,
          run: () => void openTarget(active.id, b.name),
        });
      }
    }

    // 4. Quick actions.
    if (active) {
      out.push({
        kind: "command",
        label: "New workspace tab",
        hint: "workspace",
        icon: Plus,
        run: () => newTab(active),
      });
      out.push({
        kind: "command",
        label: "Refresh listing",
        hint: "explorer",
        icon: RefreshCw,
        run: () => void explorer.refresh(),
      });
    }

    // 5. Navigate to a typed path.
    const trimmed = query.trim();
    if (trimmed && active) {
      out.push({
        kind: "navigate",
        label: `Open ${trimmed}`,
        hint: "navigate",
        icon: ArrowRight,
        run: () => void explorer.parseAndOpenPath(trimmed),
      });
    }

    return out;
  }, [buckets, active, activeBucket, activePrefix, remoteBuckets, locations, query, explorer, newTab, select]);

  if (!open) return null;

  const filtered = actions.filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q);
  });

  const GROUPS: { label: string; kinds: Action["kind"][] }[] = [
    { label: "Pinned", kinds: ["pinned"] },
    { label: "Buckets", kinds: ["saved"] },
    { label: "All buckets", kinds: ["remote"] },
    { label: "Actions", kinds: ["command", "navigate"] },
  ];

  const groups = GROUPS.map((g) => ({
    ...g,
    items: filtered.filter((a) => g.kinds.includes(a.kind)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <button
        type="button"
        aria-label="Close palette"
        className="absolute inset-0 animate-in fade-in-0 bg-black/55 backdrop-blur-sm duration-base"
        onClick={() => onOpenChange(false)}
      />
      <Command
        loop
        label="Command Palette"
        className={cn(
          "relative z-10 w-full max-w-xl origin-top animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 overflow-hidden rounded-card-lg border border-outline-variant bg-popover text-on-surface shadow-floating ring-1 ring-black/5 duration-moderate ease-emphasized",
        )}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onOpenChange(false);
          }
        }}
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Jump to a bucket or open a path…"
          className="h-12 w-full border-b border-outline-variant/60 bg-transparent px-card_padding_lg text-[14px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
        />
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-8 text-center text-[13px] text-on-surface-variant">
            No results.
          </Command.Empty>
          {groups.map((group) => (
            <Command.Group key={group.label} heading={group.label}>
              {group.items.map((action, i) => {
                const Icon = action.icon;
                return (
                  <Command.Item
                    key={`${group.label}-${action.kind}-${i}`}
                    value={`${action.label} ${action.hint}`}
                    onSelect={() => {
                      action.run();
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-instant data-[selected=true]:bg-surface-container",
                      action.active
                        ? "text-on-surface"
                        : "text-on-surface-variant data-[selected=true]:text-on-surface",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        action.active ? "text-primary" : "text-on-surface-variant/60",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-data-mono">
                      {action.label}
                    </span>
                    {action.active ? (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary">
                        active
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-on-surface-variant/50">
                      {action.hint}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

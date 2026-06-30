import {
  ClipboardCopy,
  Download,
  FileEdit,
  FileSearch,
  Link2,
  Trash2,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { Menu, MenuItem } from "@/components/ui/menu";
import type { ObjectMeta } from "@/lib/ipc";

export interface RowContextMenuProps {
  meta: ObjectMeta | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onCopyKey: (meta: ObjectMeta) => void;
  onCopyS3Uri: (meta: ObjectMeta) => void;
  onDownload: (meta: ObjectMeta) => void;
  onShare: (meta: ObjectMeta) => void;
  onEdit: (meta: ObjectMeta) => void;
  onInspect: (meta: ObjectMeta) => void;
  onDelete: (meta: ObjectMeta) => void;
}

const ITEMS: {
  key: string;
  label: string;
  icon: typeof Download;
  predicate?: (m: ObjectMeta) => boolean;
  variant?: "danger";
}[] = [
  { key: "copy-key", label: "Copy key", icon: ClipboardCopy },
  { key: "copy-uri", label: "Copy S3 URI", icon: Link2 },
  { key: "download", label: "Download", icon: Download, predicate: (m) => !m.is_dir },
  { key: "share", label: "Share presigned…", icon: Link2, predicate: (m) => !m.is_dir },
  { key: "edit", label: "Open in editor", icon: FileEdit, predicate: (m) => !m.is_dir },
  { key: "inspect", label: "Inspect .gz/.zstd", icon: FileSearch, predicate: (m) => /\.(gz|gzip|tgz|zst|zstd)$/i.test(m.key) },
  { key: "delete", label: "Delete", icon: Trash2, variant: "danger" },
];

/**
 * Right-click context menu (P4.7). Anchored at the click position; closes on
 * outside click or Escape. Items filter themselves out when the predicate
 * returns false (e.g. "Open in editor" hides on directories).
 */
export function RowContextMenu({
  meta,
  position,
  onClose,
  onCopyKey,
  onCopyS3Uri,
  onDownload,
  onShare,
  onEdit,
  onInspect,
  onDelete,
}: RowContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!position) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [position, onClose]);

  if (!position || !meta) return null;

  // Clamp to viewport so the menu never overflows the right edge.
  const x = Math.min(position.x, window.innerWidth - 240);
  const y = Math.min(position.y, window.innerHeight - 320);

  return (
    <div ref={ref}>
      <Menu
        origin="top-left"
        className="fixed w-56"
        style={{ left: x, top: y }}
      >
        {ITEMS.filter((item) => !item.predicate || item.predicate(meta)).map((item) => {
          const Icon = item.icon;
          return (
            <MenuItem
              key={item.key}
              icon={Icon}
              danger={item.variant === "danger"}
              onSelect={() => {
                switch (item.key) {
                  case "copy-key":
                    onCopyKey(meta);
                    break;
                  case "copy-uri":
                    onCopyS3Uri(meta);
                    break;
                  case "download":
                    onDownload(meta);
                    break;
                  case "share":
                    onShare(meta);
                    break;
                  case "edit":
                    onEdit(meta);
                    break;
                  case "inspect":
                    onInspect(meta);
                    break;
                  case "delete":
                    onDelete(meta);
                    break;
                }
                onClose();
              }}
            >
              {item.label}
            </MenuItem>
          );
        })}
      </Menu>
    </div>
  );
}

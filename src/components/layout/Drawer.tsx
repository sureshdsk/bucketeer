import { Maximize2, Minimize2, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  expandable?: boolean;
  children?: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  expandable,
  children,
}: DrawerProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-10 bg-black/50 backdrop-blur-sm transition-opacity duration-base",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "absolute right-0 top-0 z-20 flex h-full flex-col border-l border-outline-variant/60 bg-popover shadow-floating transition-[transform,width] duration-base ease-emphasized",
          expanded ? "w-drawer_width_wide" : "w-drawer_width",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-outline-variant/60 px-card_padding_lg">
          <div className="min-w-0">
            <h2 className="truncate text-headline-sm font-semibold tracking-tight text-on-surface">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate font-mono text-data-mono text-[11px] text-on-surface-variant">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {expandable ? (
              <button
                type="button"
                aria-label={expanded ? "Collapse drawer" : "Expand drawer"}
                title={expanded ? "Collapse" : "Expand"}
                onClick={() => setExpanded((e) => !e)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
              >
                {expanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close drawer"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-card_padding_lg">{children}</div>
      </aside>
    </>
  );
}

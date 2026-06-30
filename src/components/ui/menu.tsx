import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MenuOrigin = "top-left" | "top-right" | "bottom-right";

export interface MenuProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  origin?: MenuOrigin;
}

export function Menu({
  children,
  className,
  style,
  origin = "top-left",
}: MenuProps) {
  return (
    <div
      style={style}
      className={cn(
        "z-50 min-w-44 overflow-hidden rounded-card border border-outline-variant bg-popover p-1 text-[13px] shadow-floating",
        "animate-in fade-in-0 zoom-in-95 duration-fast ease-out-soft",
        origin === "top-right" && "origin-top-right",
        origin === "top-left" && "origin-top-left",
        origin === "bottom-right" && "origin-bottom-right",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps {
  icon?: LucideIcon;
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export function MenuItem({
  icon: Icon,
  children,
  onSelect,
  danger,
  disabled,
  trailing,
  className,
}: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors duration-instant",
        danger
          ? "text-destructive hover:bg-error-container/15"
          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" /> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-wider text-on-surface-variant/70">
      {children}
    </div>
  );
}

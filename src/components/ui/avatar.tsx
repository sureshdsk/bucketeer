import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[12px]",
  lg: "h-10 w-10 text-[14px]",
};

const iconSizes: Record<AvatarSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export interface AvatarProps {
  name?: string;
  icon?: LucideIcon;
  size?: AvatarSize;
  className?: string;
  "aria-label"?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Avatar({
  name,
  icon: Icon,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: AvatarProps) {
  return (
    <span
      aria-label={ariaLabel ?? name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-container font-semibold text-on-primary-container ring-1 ring-inset ring-primary/15",
        sizeClasses[size],
        className,
      )}
    >
      {Icon ? (
        <Icon className={iconSizes[size]} />
      ) : name ? (
        <span aria-hidden>{initials(name)}</span>
      ) : null}
    </span>
  );
}

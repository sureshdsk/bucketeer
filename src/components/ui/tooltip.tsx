import * as React from "react";

import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: TooltipSide;
  delay?: number;
  className?: string;
}

const sideClasses: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

const originClass: Record<TooltipSide, string> = {
  top: "origin-bottom",
  bottom: "origin-top",
  left: "origin-right",
  right: "origin-left",
};

export function Tooltip({
  label,
  children,
  side = "top",
  delay = 250,
  className,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  const show = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-outline-variant bg-popover px-2 py-1 text-[11px] font-medium text-on-surface shadow-floating",
            "animate-in fade-in-0 zoom-in-95 duration-fast ease-out-soft",
            originClass[side],
            sideClasses[side],
            className,
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

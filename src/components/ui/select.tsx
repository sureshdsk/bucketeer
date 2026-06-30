import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  align = "left",
  className,
  triggerClassName,
  ...rest
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        {...rest}
        className={cn(
          "flex h-8 min-w-[7rem] items-center justify-between gap-2 rounded-md border border-outline-variant/70 bg-card px-2.5 text-[13px] text-on-surface transition-colors duration-fast hover:border-outline focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          triggerClassName,
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform duration-fast",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 min-w-full animate-in fade-in-0 zoom-in-95 overflow-hidden rounded-card border border-outline-variant bg-popover p-1 shadow-floating duration-fast ease-out-soft",
            align === "right" ? "right-0 top-full" : "left-0 top-full",
          )}
        >
          <ul>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onValueChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors duration-instant",
                      active
                        ? "bg-surface-container text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {active ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

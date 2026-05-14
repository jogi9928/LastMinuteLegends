"use client";

import { cn } from "@/lib/utils";

interface Props {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function OptionCard({ selected, onClick, title, subtitle, icon, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
        "hover:border-primary/60 hover:bg-primary/5",
        selected
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border bg-card",
        className
      )}
    >
      {icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
            selected ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex-1">
        <div className="text-base font-semibold leading-tight">{title}</div>
        {subtitle ? <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div
        className={cn(
          "h-2.5 w-2.5 rounded-full transition-colors",
          selected ? "bg-primary shadow-[0_0_10px_2px_hsl(var(--primary)/0.5)]" : "bg-border"
        )}
      />
    </button>
  );
}

import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "good" | "warn" | "danger";

const variantClass: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-800 text-zinc-200",
  good: "bg-emerald-900/60 text-emerald-300",
  warn: "bg-amber-900/60 text-amber-300",
  danger: "bg-red-900/60 text-red-300",
};

export function Badge({
  className,
  variant = "neutral",
  children,
}: {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variantClass[variant], className)}>
      {children}
    </span>
  );
}


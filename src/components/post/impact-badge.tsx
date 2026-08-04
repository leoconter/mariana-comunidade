import { CLINICAL_IMPACT } from "@/lib/post-fields";
import { cn } from "@/lib/utils";

export function ImpactBadge({
  value,
  compact = false,
}: {
  value: string | null | undefined;
  compact?: boolean;
}) {
  if (!value) return null;
  const impact = CLINICAL_IMPACT[value];
  if (!impact) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        impact.className
      )}
    >
      <span aria-hidden>{impact.emoji}</span>
      {compact ? impact.label.split(" — ")[0] : impact.label}
    </span>
  );
}

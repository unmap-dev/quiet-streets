import { cn } from "@/lib/utils";

/**
 * A pinned place's number, as its map marker, its row in the tray and its column in the
 * comparison all show it, so the three read as one place. Inverted against the page, so it stays
 * distinct from the block's own marker, which is drawn in the accent.
 */
export function PinBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[0.6875rem] leading-none font-semibold text-background tabular-nums",
        className,
      )}
    >
      {n}
    </span>
  );
}

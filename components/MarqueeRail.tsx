import { IntentLink as Link } from "@/components/IntentLink";
import { cn } from "@/lib/utils";

function BurstStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M12 0.6 13.35 8.7 20.9 3.5 15.3 10.65 23.4 12 15.3 13.35 20.9 20.5 13.35 15.3 12 23.4 10.65 15.3 3.1 20.5 8.7 13.35 0.6 12 8.7 10.65 3.1 3.5 10.65 8.7Z" />
    </svg>
  );
}

export type MarqueeRailItem = {
  label: string;
  href?: string;
};

export function MarqueeRail({
  items,
  label,
  duration = 72,
  className,
}: {
  items: MarqueeRailItem[];
  label: string;
  duration?: number;
  className?: string;
}) {
  const unique = items.filter((item) => item.label.trim().length > 0);
  if (unique.length === 0) return null;

  const loop = [...unique, ...unique];

  return (
    <section
      aria-label={label}
      className={cn(
        "overflow-hidden border-y border-border bg-card",
        className,
      )}
    >
      <div
        className="marquee-track min-h-14 items-center gap-7 px-5"
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((item, index) => (
          <span
            key={`${item.label}-${index}`}
            className="flex items-center gap-7"
          >
            {item.href ? (
              <Link
                href={item.href}
                className="text-sm tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-sm tracking-[0.14em] text-muted-foreground uppercase">
                {item.label}
              </span>
            )}
            <BurstStar className="size-3.5 shrink-0 text-primary sm:size-4" />
          </span>
        ))}
      </div>
    </section>
  );
}

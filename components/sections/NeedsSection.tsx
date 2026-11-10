import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreImage } from "@/components/StoreImage";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { pageContainer, sectionStackClass, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";

export type CatalogTile = {
  title: string;
  text: string;
  href: string;
  image: string;
  alt: string;
};

const tileSizes = ["feature", "wide", "compact", "compact"] as const;

const tileClass = {
  feature: "min-h-[28rem] sm:col-span-2 lg:col-span-2 lg:row-span-2 lg:min-h-0",
  wide: "min-h-72 sm:col-span-2 lg:col-span-2 lg:min-h-0",
  compact: "min-h-64 lg:min-h-0",
};

const titleClass = {
  feature: "max-w-md text-3xl sm:text-4xl lg:text-[2.85rem]",
  wide: "text-2xl sm:text-3xl",
  compact: "text-2xl leading-tight",
};

const copyClass = {
  feature: "mt-3 max-w-md text-sm leading-relaxed text-white/85 sm:text-base",
  wide: "mt-2 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base",
  compact: "mt-2 line-clamp-2 text-sm leading-snug text-white/80",
};

export function NeedsSection({ tiles }: { tiles: CatalogTile[] }) {
  const needs = tiles.slice(0, 4).map((tile, index) => ({
    ...tile,
    tile: tileSizes[index] ?? "compact",
  }));
  if (!needs.length) return null;
  return (
    <section
      id="categories"
      aria-labelledby="needs-heading"
      className={cn("border-b border-border", sectionYClass)}
    >
      <div className={pageContainer(sectionStackClass)}>
        <SectionHeader
          eyebrow="Collections"
          title="Shop electronics by what you are building"
          subtitle="Categories and photos from the live catalog."
          titleId="needs-heading"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:h-[42rem] lg:grid-cols-4 lg:grid-rows-2">
          {needs.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "dark group relative isolate flex overflow-hidden rounded-2xl bg-background text-foreground",
                tileClass[item.tile],
              )}
            >
              {item.image ? (
                <StoreImage
                  src={item.image}
                  alt={item.alt}
                  sizes={
                    item.tile === "compact"
                      ? "(min-width: 1024px) 22vw, (min-width: 640px) 50vw, 100vw"
                      : "(min-width: 1024px) 46vw, 100vw"
                  }
                  className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              ) : null}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-background/92 via-background/45 to-background/10"
              />
              <div
                className={cn(
                  "relative mt-auto flex w-full flex-col",
                  item.tile === "feature" ? "p-6 sm:p-8" : "p-5 sm:p-6",
                )}
              >
                <h3 className={cn("font-display text-balance", titleClass[item.tile])}>
                  {item.title}
                </h3>
                <p className={copyClass[item.tile]}>{item.text}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Shop collection
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { IntentLink as Link } from "@/components/IntentLink";
import { StoreImage } from "@/components/StoreImage";
import type { Category, StoreSettings } from "@/lib/types";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { Reveal } from "@/components/sections/Reveal";
import { hoverLiftClass, imageZoomClass } from "@/lib/motion";
import { useMotionEnabled } from "@/lib/use-motion-enabled";
import { pageContainer, sectionStackClass, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";

export function CategoriesSection({
  categories,
  settings,
}: {
  categories: Category[];
  settings: StoreSettings;
}) {
  const { enabled } = useMotionEnabled();
  const resolved = categories
    .filter((category) => category.parent === 0)
    .slice(0, 3);

  return (
    <section
      id="categories"
      aria-labelledby="categories-heading"
      className={cn("border-b border-border", sectionYClass)}
    >
      <div className={pageContainer(sectionStackClass)}>
        <SectionHeader
          eyebrow="Catalog"
          title="Categories"
          subtitle="Browse the categories from the store."
          titleId="categories-heading"
        />

        {resolved.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <p className="font-medium">No categories yet</p>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              Add categories and products in WooCommerce admin to show them
              here.
            </p>
          </div>
        ) : (
          <ul
            className={cn(
              "grid gap-4",
              resolved.length <= 3
                ? "grid-cols-1 sm:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {resolved.map((category, index) => (
              <Reveal
                key={category.id}
                delay={index * 0.05}
                as="li"
                className="h-full"
              >
                <Link
                  href={`/collection/${category.slug}`}
                  aria-label={`Shop ${category.name}, ${category.count} products`}
                  className={cn(
                    "group relative flex h-full min-h-64 flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    enabled && hoverLiftClass,
                  )}
                >
                  <StoreImage
                    src={category.image || settings.logo}
                    alt={category.imageAlt || category.name}
                    fallbackSrc={settings.logo}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className={cn("object-cover", enabled && imageZoomClass)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                  <div className="relative z-10 flex flex-col gap-1 p-5 sm:p-6">
                    <span className="text-xs tabular-nums text-white/75">
                      {category.count} product{category.count === 1 ? "" : "s"}
                    </span>
                    <span className="font-display text-xl text-balance text-white sm:text-2xl">
                      {category.name}
                    </span>
                    {category.description ? (
                      <span className="line-clamp-2 text-sm text-white/80">
                        {category.description}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

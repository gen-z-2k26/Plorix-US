"use client";

import { IntentLink as Link } from "@/components/IntentLink";
import { motion } from "motion/react";
import type { Category, Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { useMotionEnabled } from "@/lib/use-motion-enabled";
import { easings } from "@/lib/motion";
import { pageContainer, sectionStackClass, sectionYClass } from "@/lib/layout";

export function FeaturedProductsSection({
  products,
  groups = [],
}: {
  products: Product[];
  groups?: { category: Category; products: Product[] }[];
}) {
  const featured = products;
  const { enabled } = useMotionEnabled();
  const sections =
    groups.length > 0
      ? groups
          .map((group) => ({
            ...group,
            products: group.products.slice(0, 3),
          }))
          .filter((group) => group.products.length > 0)
          .slice(0, 3)
      : featured.length > 0
        ? [{ category: null, products: featured.slice(0, 3) }]
        : [];

  return (
    <section
      id="featured"
      aria-labelledby="featured-heading"
      className={sectionYClass}
    >
      <div className={pageContainer(sectionStackClass)}>
        <SectionHeader
          eyebrow="Featured"
          title="Featured products"
          subtitle="A few products from each category in the catalog."
          titleId="featured-heading"
          action={
            <Link
              href="/products"
              className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              All products →
            </Link>
          }
        />

        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <p className="font-medium">No products yet</p>
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              Products will show here when the catalog is published.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map((group) => (
              <div key={group.category?.id ?? "featured"} className="space-y-4">
                {group.category ? (
                  <div className="flex items-end justify-between gap-4">
                    <h3 className="font-display text-2xl text-balance">
                      {group.category.name}
                    </h3>
                    <Link
                      href={`/collection/${group.category.slug}`}
                      className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View category
                    </Link>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.products.map((product, index) =>
                    enabled ? (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
                        transition={{
                          duration: 0.28,
                          delay: Math.min(index * 0.04, 0.16),
                          ease: easings.standard,
                        }}
                      >
                        <ProductCard product={product} />
                      </motion.div>
                    ) : (
                      <ProductCard key={product.id} product={product} />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

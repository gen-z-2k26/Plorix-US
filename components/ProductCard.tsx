"use client";

import { IntentLink as Link } from "@/components/IntentLink";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Eye, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import { addProductToCart, isCatalogConflictError } from "@/lib/add-to-cart";
import { userErrorMessage } from "@/lib/user-error";
import { useCartStore } from "@/lib/cart-store";
import { useMotionEnabled } from "@/lib/use-motion-enabled";
import { hoverLiftClass } from "@/lib/motion";
import { ProductImageCarousel } from "@/components/ProductImageCarousel";
import { ProductStatusBadges } from "@/components/ProductStatusBadges";
import { QuickViewModal } from "@/components/QuickViewModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { settings } = useStore();
  const setError = useCartStore((state) => state.setError);
  const { enabled } = useMotionEnabled();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [rejectedId, setRejectedId] = useState<string | null>(null);
  const inStock = product.inStock && rejectedId !== product.id;

  async function handleAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!inStock || busy) return;
    setBusy(true);
    try {
      await addProductToCart(product, 1);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch (error) {
      if (isCatalogConflictError(error)) {
        setRejectedId(product.id);
        router.refresh();
      }
      setError(userErrorMessage(error, "Could not add to cart."));
    } finally {
      setBusy(false);
    }
  }

  function handleQuickView(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setQuickOpen(true);
  }

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col rounded-2xl border border-border bg-card p-2.5 shadow-sm",
          enabled && hoverLiftClass,
        )}
      >
        <div className="relative overflow-hidden rounded-xl bg-muted/60">
          <Link
            href={`/products/${product.slug}`}
            aria-label={`View ${product.name}`}
            className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />

          <ProductImageCarousel
            images={product.images}
            alt={product.imageAlts[0] || product.name}
            fallbackImage={settings.logo}
            showOnHover
            rounded="rounded-xl"
            className={cn(
              "relative z-[1] aspect-[16/11] pointer-events-none",
              !inStock && "opacity-75 saturate-50",
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />

          <div className="pointer-events-none absolute top-2.5 left-2.5 z-20">
            <ProductStatusBadges product={product} overlay />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleQuickView}
            aria-label={`Quick view ${product.name}`}
            title="Quick view"
            className="
              absolute top-2.5 right-2.5 z-20 border-black/10 bg-white text-neutral-950 shadow-md
              opacity-100 sm:scale-90 sm:opacity-0
              group-hover:scale-100 group-hover:opacity-100
              hover:bg-white hover:text-neutral-950
              focus-visible:scale-100 focus-visible:opacity-100
              dark:border-black/10 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 dark:hover:text-neutral-950
            "
          >
            <Eye className="size-3.5 text-neutral-950" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-2.5 px-1.5 pt-3 pb-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs tracking-wider text-muted-foreground uppercase">
              {product.category || "\u00a0"}
            </span>
            <span className="text-xs text-muted-foreground">
              {inStock ? "In stock" : "Out of stock"}
            </span>
          </div>

          <Link
            href={`/products/${product.slug}`}
            title={product.name}
            className="group/title flex items-center justify-between gap-1.5 focus-visible:outline-none"
          >
            <h3 className="truncate text-lg tracking-tight text-foreground transition-colors group-hover/title:text-primary">
              {product.name}
            </h3>
            <ArrowUpRight className="size-3.5 shrink-0 -translate-x-1 translate-y-0.5 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 group-hover/title:text-primary" />
          </Link>

          <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-border pt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base tabular-nums tracking-tight text-foreground">
                {formatPrice(product.price, settings)}
              </span>
              {product.onSale && product.regularPrice > product.price ? (
                <span className="text-xs tabular-nums text-muted-foreground line-through">
                  {formatPrice(product.regularPrice, settings)}
                </span>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              disabled={!inStock || busy}
              onClick={handleAdd}
              aria-label={
                inStock
                  ? `Add ${product.name} to cart`
                  : `${product.name} is out of stock`
              }
              className={cn(
                "relative z-20",
                added && "bg-success text-background hover:bg-success",
                !added &&
                  inStock &&
                  "sm:translate-y-1 sm:opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100",
                !inStock &&
                  "sm:opacity-0 group-hover:opacity-100",
              )}
            >
              {added ? (
                <>
                  <Check className="size-3.5" />
                  Added
                </>
              ) : inStock ? (
                <>
                  <ShoppingBag className="size-3.5" />
                  Add
                </>
              ) : (
                "Unavailable"
              )}
            </Button>
          </div>
        </div>
      </article>

      <QuickViewModal
        product={product}
        open={quickOpen}
        onOpenChange={setQuickOpen}
      />
    </>
  );
}

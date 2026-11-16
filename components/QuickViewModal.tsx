"use client";

import { IntentLink as Link } from "@/components/IntentLink";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductImageCarousel } from "@/components/ProductImageCarousel";
import { QuantityPicker } from "@/components/QuantityPicker";
import { addProductToCart, isCatalogConflictError } from "@/lib/add-to-cart";
import { userErrorMessage } from "@/lib/user-error";
import { useCartStore } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductStatusBadges } from "@/components/ProductStatusBadges";
import { cn } from "@/lib/utils";

export function QuickViewModal({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings } = useStore();
  const router = useRouter();
  const setError = useCartStore((state) => state.setError);
  const [active, setActive] = useState<Product | null>(product);
  const [rejectedId, setRejectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    if (product) {
      setActive(product);
      setQuantity(1);
      setAdded(false);
      setWishlisted(false);
    }
  }, [product]);

  if (!active) return null;

  const inStock = Boolean(active?.inStock) && rejectedId !== active?.id;

  async function handleAdd() {
    if (!active || !inStock || busy) return;
    setBusy(true);
    try {
      await addProductToCart(active, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1200);
    } catch (error) {
      if (isCatalogConflictError(error)) {
        setRejectedId(active.id);
        router.refresh();
      }
      setError(userErrorMessage(error, "Could not add to cart."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-lg sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">{active.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Quick view for {active.name}
        </DialogDescription>

        <div className="grid max-h-[92dvh] overflow-hidden rounded-2xl bg-background text-foreground md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="relative min-h-64 bg-muted md:min-h-[32rem]">
            <ProductImageCarousel
              images={active.images}
              alt={active.name}
              fallbackImage={settings.logo}
              rounded="rounded-none"
              className="absolute inset-0 size-full"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>

          <div className="flex min-h-0 flex-col bg-card">
            <div className="flex items-start justify-end px-5 pt-4">
              <button
                type="button"
                aria-label="Close quick view"
                onClick={() => onOpenChange(false)}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-4 sm:px-6">
              {active.category ? (
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {active.category}
                </p>
              ) : null}
              <h2 className="text-balance text-xl leading-snug font-medium tracking-tight sm:text-2xl">
                {active.name}
              </h2>
              <div className="flex flex-wrap items-baseline gap-2">
                {active.onSale && active.regularPrice > active.price ? (
                  <p className="text-sm tabular-nums text-muted-foreground line-through">
                    {formatPrice(active.regularPrice, settings)}
                  </p>
                ) : null}
                <p className="text-xl tabular-nums tracking-tight">
                  {formatPrice(active.price, settings)}
                </p>
              </div>
              <ProductStatusBadges product={active} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-y border-border px-5 py-4 sm:px-6">
              {(active.specGroups?.[0]?.rows.length ?? 0) > 0 ? (
                <dl className="grid grid-cols-1 gap-px">
                  {active.specGroups[0].rows.slice(0, 10).map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[minmax(7rem,0.9fr)_1.1fr] gap-3 border-b border-border/70 py-2 text-sm last:border-b-0"
                    >
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-right">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {active.description}
                </p>
              )}
            </div>

            <div className="space-y-3 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <QuantityPicker
                  value={quantity}
                  disabled={!inStock}
                  onChange={setQuantity}
                />

                <Button
                  type="button"
                  size="lg"
                  disabled={!inStock || busy}
                  onClick={() => void handleAdd()}
                  className="flex-1"
                >
                  <ShoppingBag className="size-4" />
                  {added ? "Added" : inStock ? "Add to cart" : "Unavailable"}
                </Button>

                <button
                  type="button"
                  aria-label={
                    wishlisted ? "Remove from wishlist" : "Add to wishlist"
                  }
                  aria-pressed={wishlisted}
                  onClick={() => setWishlisted((value) => !value)}
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-xl border border-border bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    wishlisted
                      ? "text-destructive"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Heart className={cn("size-5", wishlisted && "fill-current")} />
                </button>
              </div>

              <Link
                href={`/products/${active.slug}`}
                onClick={() => onOpenChange(false)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-11 w-full",
                )}
              >
                View full details
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

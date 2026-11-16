"use client";

import { IntentLink as Link } from "@/components/IntentLink";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartItemRow } from "@/components/CartItemRow";
import { useCartStore } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { applyCouponAction, removeCouponAction } from "@/app/actions/cart";
import { unwrapCart } from "@/lib/cart-result";
import { userErrorMessage } from "@/lib/user-error";
import { toast } from "@/lib/toast-store";

export function CartDrawer() {
  const { settings } = useStore();
  const cart = useCartStore((state) => state.cart);
  const error = useCartStore((state) => state.error);
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);
  const setCart = useCartStore((state) => state.setCart);
  const setError = useCartStore((state) => state.setError);
  const [coupon, setCoupon] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const items = cart.items;
  const totals = cart.totals;

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponBusy(true);
    try {
      const next = unwrapCart(await applyCouponAction(coupon));
      setCart(next);
      toast({ title: "Coupon applied", description: coupon.trim() });
      setCoupon("");
    } catch (err) {
      const message = userErrorMessage(err, "Coupon could not be applied.");
      setError(message);
      toast({ title: "Coupon could not be applied", description: message, variant: "error" });
    } finally {
      setCouponBusy(false);
    }
  }

  async function removeCoupon(code: string) {
    setCouponBusy(true);
    try {
      setCart(unwrapCart(await removeCouponAction(code)));
      toast({ title: "Coupon removed", description: code });
    } catch (err) {
      const message = userErrorMessage(err, "Coupon could not be removed.");
      setError(message);
      toast({ title: "Coupon could not be removed", description: message, variant: "error" });
    } finally {
      setCouponBusy(false);
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          data-lenis-prevent
          className="flex w-full flex-col gap-0 overflow-y-auto overscroll-contain sm:max-w-md"
        >
          <SheetHeader className="space-y-1.5">
            <SheetTitle>Your cart</SheetTitle>
            <SheetDescription>
              Prices, tax, and shipping come from WooCommerce.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <p className="font-medium">Your cart is empty</p>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  Add a product to get started.
                </p>
                <Link
                  href="/products"
                  onClick={() => setOpen(false)}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "mt-5",
                  )}
                >
                  Browse products
                </Link>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <CartItemRow key={item.key} item={item} />
                ))}
              </AnimatePresence>
            )}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <SheetFooter className="gap-3 border-t border-border">
            {items.length > 0 ? (
              <div className="w-full space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={coupon}
                    onChange={(event) => setCoupon(event.target.value)}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={couponBusy || !coupon.trim()}
                    onClick={() => void applyCoupon()}
                  >
                    Apply
                  </Button>
                </div>
                {cart.coupons.map((entry) => (
                  <div
                    key={entry.code}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{entry.code}</span>
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => void removeCoupon(entry.code)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {formatPrice(totals.subtotal, settings)}
                    </span>
                  </div>
                  {totals.discount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums">
                        -{formatPrice(totals.discount, settings)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="tabular-nums">
                      {formatPrice(totals.shipping, settings)}
                    </span>
                  </div>
                  {totals.tax > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="tabular-nums">
                        {formatPrice(totals.tax, settings)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-1 text-base">
                    <span>Total</span>
                    <span className="tabular-nums tracking-tight">
                      {formatPrice(totals.total, settings)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            <p className="w-full text-xs text-muted-foreground">
              {settings.footer?.trustLine ||
                "Free shipping · 30-day returns · Secure checkout"}
            </p>
            {items.length ? (
              <Link
                href="/checkout"
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
                onClick={() => setOpen(false)}
              >
                Checkout
              </Link>
            ) : (
              <Button type="button" size="lg" disabled>
                Checkout
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

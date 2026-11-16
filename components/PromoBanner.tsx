"use client";

import { IntentLink as Link } from "@/components/IntentLink";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { applyCouponAction } from "@/app/actions/cart";
import { unwrapCart } from "@/lib/cart-result";
import { useCartStore } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { pageContainer } from "@/lib/layout";
import { toast } from "@/lib/toast-store";
import { userErrorMessage } from "@/lib/user-error";

function dismissKey(id: string) {
  return `promo-dismissed:${id}`;
}

export function PromoBanner() {
  const { settings } = useStore();
  const setCart = useCartStore((state) => state.setCart);
  const openCart = useCartStore((state) => state.openCart);
  const setError = useCartStore((state) => state.setError);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  const message = settings.promoBanner?.trim() || "";
  const promoId = settings.promoId || message;
  const coupon = settings.promoCoupon?.trim() || "";

  useEffect(() => {
    if (!message) {
      setHidden(true);
      return;
    }
    try {
      setHidden(window.localStorage.getItem(dismissKey(promoId)) === "1");
    } catch {
      setHidden(false);
    }
  }, [message, promoId]);

  if (!message || hidden) return null;

  async function applyOffer() {
    if (!coupon || busy) return;
    setBusy(true);
    try {
      setCart(unwrapCart(await applyCouponAction(coupon)), { open: true });
      toast({ title: "Offer applied", description: coupon });
      openCart();
    } catch (error) {
      const message = userErrorMessage(error, "Could not apply the offer.");
      setError(message);
      toast({ title: "Could not apply the offer", description: message, variant: "error" });
      openCart();
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(dismissKey(promoId), "1");
    } catch {
      // Ignore private-mode storage failures.
    }
  }

  return (
    <div className="bg-primary text-primary-foreground">
      <div
        className={pageContainer(
          "relative flex items-center justify-center gap-8 py-2.5 pr-10 text-center text-sm tracking-wide sm:text-base",
        )}
      >
        {coupon ? (
          <button
            type="button"
            className="min-w-0 font-medium underline-offset-4 hover:underline"
            onClick={() => void applyOffer()}
            disabled={busy}
          >
            {message}
          </button>
        ) : (
          <Link href="/products" className="min-w-0 font-medium underline-offset-4 hover:underline">
            {message}
          </Link>
        )}
        <button
          type="button"
          className="absolute top-1/2 right-0 -translate-y-1/2 rounded-lg p-1.5 opacity-80 transition-opacity hover:opacity-100"
          aria-label="Dismiss offer"
          onClick={dismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

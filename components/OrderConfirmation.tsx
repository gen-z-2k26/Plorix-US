"use client";

import { useEffect, useState } from "react";
import { IntentLink as Link } from "@/components/IntentLink";
import { Check, Copy, Mail, Package, Truck } from "lucide-react";
import { completeCheckoutAction } from "@/app/actions/checkout";
import { lookupGuestOrderAction } from "@/app/actions/orders";
import { emptyStoreCart } from "@/lib/api/map-cart";
import { useCartStore } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { formatPrice } from "@/lib/format";
import { pageContainer } from "@/lib/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StoreImage } from "@/components/StoreImage";
import type { Address, GuestOrder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-store";
import { unwrapResult } from "@/lib/cart-result";
import { userErrorMessage } from "@/lib/user-error";

function formatAddress(address: Address) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const lines = [
    name,
    address.company,
    address.address1,
    address.address2,
    [address.city, address.state, address.postcode].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);
  return lines;
}

function statusLabel(order: GuestOrder) {
  if (order.paid) return "Paid";
  const status = order.status?.replace(/-/g, " ") || "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function OrderConfirmation({
  orderId,
  orderKey,
  email,
  paymentIntentId,
  redirectStatus,
  provider = "stripe",
}: {
  orderId: string;
  orderKey: string;
  email: string;
  paymentIntentId: string;
  redirectStatus: string;
  provider?: "stripe" | "paypal" | "afterpay" | "mock";
}) {
  const { settings } = useStore();
  const setCart = useCartStore((state) => state.setCart);
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [lookupEmail, setLookupEmail] = useState(email);
  const [lookupKey, setLookupKey] = useState(orderKey);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const afterpayOk =
          provider === "afterpay" && redirectStatus.toUpperCase() === "SUCCESS";
        const afterpayCancelled =
          provider === "afterpay" &&
          redirectStatus &&
          redirectStatus.toUpperCase() !== "SUCCESS";
        if (afterpayCancelled || (provider !== "afterpay" && redirectStatus && redirectStatus !== "succeeded")) {
          setError("Payment was not completed. You can retry checkout from your cart.");
          return;
        }
        if (
          paymentIntentId &&
          (afterpayOk || redirectStatus === "succeeded" || !redirectStatus)
        ) {
          const paid = unwrapResult(
            await completeCheckoutAction({
              orderId,
              orderKey,
              paymentIntentId,
              provider: afterpayOk ? "afterpay" : provider,
            }),
          );
          if (cancelled) return;
          setCart(emptyStoreCart());
          toast({
            title: "Order completed",
            description: "Kindly check your email for the order details and tracking link.",
          });
          const guest = paid.email
            ? await lookupGuestOrderAction({
                orderId: paid.orderId,
                orderKey: paid.orderKey || orderKey,
                email: paid.email,
              })
                .then(unwrapResult)
                .catch(() => null)
            : null;
          if (cancelled) return;
          if (guest) {
            setOrder(guest);
            return;
          }
          setOrder({
            orderId: paid.orderId,
            orderKey: paid.orderKey,
            status: paid.status,
            paid: paid.paid,
            email: paid.email,
            name: paid.name,
            totals: {
              subtotal: paid.total,
              discount: 0,
              shipping: 0,
              tax: 0,
              total: paid.total,
              currency: paid.currency,
              minorUnit: 2,
              totalMinor: String(Math.round(paid.total * 100)),
            },
            items: paid.items.map((item, index) => ({
              key: `${item.productId}-${index}`,
              productId: item.productId,
              slug: item.slug,
              name: item.name,
              price: item.price,
              image: item.image,
              quantity: item.quantity,
              quantityMin: 1,
              quantityMax: item.quantity,
            })),
            shippingAddress: emptyStoreCart().shippingAddress,
            billingAddress: emptyStoreCart().billingAddress,
            coupons: [],
            createdAt: paid.createdAt,
          });
          return;
        }
        if (orderKey && email) {
          const guest = unwrapResult(
            await lookupGuestOrderAction({
              orderId,
              orderKey,
              email,
            }),
          );
          if (!cancelled) setOrder(guest);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            userErrorMessage(
              err,
              "Could not load this order. Check the link in your email and try again.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, orderKey, email, paymentIntentId, redirectStatus, provider, setCart]);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setOrder(
        unwrapResult(
          await lookupGuestOrderAction({
            orderId,
            orderKey: lookupKey,
            email: lookupEmail,
          }),
        ),
      );
    } catch (err) {
      setError(
        userErrorMessage(err, "Order not found. Check the order key and email."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyOrderNumber() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(String(order.orderId));
      toast({ title: "Order number copied" });
    } catch {
      toast({ title: "Could not copy", variant: "error" });
    }
  }

  const trackHref = order
    ? `/track-your-order?order=${encodeURIComponent(order.orderId)}&key=${encodeURIComponent(order.orderKey)}&email=${encodeURIComponent(order.email)}`
    : "/track-your-order";
  const firstName = order?.name?.trim().split(" ")[0] || "";
  const currency = order?.totals.currency;
  const shipLines = order ? formatAddress(order.shippingAddress) : [];
  const billLines = order ? formatAddress(order.billingAddress) : [];

  const steps = [
    {
      icon: Mail,
      title: "Check your email",
      text: "Your receipt, order key, and tracking link are in the confirmation.",
    },
    {
      icon: Package,
      title: "We prepare it",
      text: "Items stay in processing while they are picked and packed.",
    },
    {
      icon: Truck,
      title: "Track delivery",
      text: "Carrier updates appear after the package is picked up.",
    },
  ];

  return (
    <div className="pb-16">
      {loading ? (
        <div className={pageContainer("py-28 text-center")}>
          <p className="text-sm font-medium text-foreground">Confirming your order...</p>
        </div>
      ) : null}

      {error && !order ? (
        <div className={pageContainer("mx-auto max-w-lg space-y-4 py-16 text-center")}>
          <h1 className="font-display text-4xl text-foreground">We could not confirm this order</h1>
          <p className="text-foreground/80">{error}</p>
          <Link href="/products" className={cn(buttonVariants(), "inline-flex")}>
            Return to shop
          </Link>
        </div>
      ) : null}

      {!order && !loading && !error ? (
        <div className={pageContainer("mx-auto max-w-md py-16")}>
          <h1 className="font-display text-4xl text-foreground">Find your order</h1>
          <p className="mt-3 text-sm text-foreground/75">
            Enter the order key and billing email for order {orderId}.
          </p>
          <form className="mt-8 space-y-4" onSubmit={(event) => void lookup(event)}>
            <div className="space-y-2">
              <Label htmlFor="confirm-key">Order key</Label>
              <Input
                id="confirm-key"
                value={lookupKey}
                onChange={(event) => setLookupKey(event.target.value)}
                placeholder="wc_order_..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-email">Email</Label>
              <Input
                id="confirm-email"
                type="email"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              View order
            </Button>
          </form>
        </div>
      ) : null}

      {order ? (
        <>
          <section className="bg-foreground text-background">
            <div className={pageContainer("py-12 sm:py-16")}>
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-background text-foreground">
                  <Check className="size-8" strokeWidth={2.75} aria-hidden />
                </span>
                <p className="mt-6 text-xs font-semibold tracking-[0.22em] uppercase text-background/70">
                  {settings.name}
                </p>
                <h1 className="mt-3 font-display text-4xl text-background sm:text-6xl">
                  {firstName ? `Thank you, ${firstName}` : "Thank you"}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-pretty text-base text-background/85">
                  Payment received. We emailed the receipt to{" "}
                  <span className="font-semibold text-background">
                    {order.email || "your inbox"}
                  </span>
                  .
                </p>
                <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-background px-2 py-2 pl-4 text-foreground">
                  <span className="text-sm">Order</span>
                  <span className="text-sm font-semibold tabular-nums">#{order.orderId}</span>
                  <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
                    {statusLabel(order)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyOrderNumber()}
                    className="rounded-full p-2 text-foreground hover:bg-foreground/10"
                    aria-label="Copy order number"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className={pageContainer("space-y-8 pt-8 sm:pt-10")}>
            <ol className="grid gap-3 sm:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-foreground/15 bg-card p-5 text-left"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                    {index + 1}
                  </span>
                  <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <step.icon className="size-4" aria-hidden />
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
              <section className="rounded-2xl border border-foreground/15 bg-card p-5 sm:p-8">
                <h2 className="font-display text-2xl text-foreground">Order details</h2>
                <ul className="mt-5 divide-y divide-foreground/10">
                  {order.items.map((item) => (
                    <li key={item.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-muted">
                        <StoreImage src={item.image} alt="" sizes="80px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="mt-1 text-sm text-foreground/70">Qty {item.quantity}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {formatPrice(item.price * item.quantity, settings, currency)}
                      </p>
                    </li>
                  ))}
                </ul>

                <div className="mt-2 grid gap-4 border-t border-foreground/10 pt-6 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted p-4">
                    <p className="text-xs font-semibold tracking-wide uppercase text-foreground/60">
                      Shipping
                    </p>
                    {shipLines.length ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                        {shipLines.join("\n")}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-foreground/75">Same details as checkout.</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-muted p-4">
                    <p className="text-xs font-semibold tracking-wide uppercase text-foreground/60">
                      Billing
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {order.email || "Email on file"}
                    </p>
                    {billLines.length ? (
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                        {billLines.join("\n")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <aside className="space-y-4 lg:sticky lg:top-24">
                <div className="overflow-hidden rounded-2xl border border-foreground/15 bg-card">
                  <div className="space-y-2.5 p-5 text-sm sm:p-6">
                    <h2 className="font-display text-xl text-foreground">Summary</h2>
                    <div className="flex justify-between pt-2 text-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">
                        {formatPrice(order.totals.subtotal, settings, currency)}
                      </span>
                    </div>
                    {order.totals.discount > 0 ? (
                      <div className="flex justify-between text-foreground">
                        <span>Discount</span>
                        <span className="tabular-nums">
                          -{formatPrice(order.totals.discount, settings, currency)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-foreground">
                      <span>Shipping</span>
                      <span className="tabular-nums">
                        {formatPrice(order.totals.shipping, settings, currency)}
                      </span>
                    </div>
                    {order.totals.tax > 0 ? (
                      <div className="flex justify-between text-foreground">
                        <span>Tax</span>
                        <span className="tabular-nums">
                          {formatPrice(order.totals.tax, settings, currency)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between bg-foreground px-5 py-4 text-background sm:px-6">
                    <span className="text-sm font-semibold tracking-wide uppercase">Total</span>
                    <span className="font-display text-2xl tabular-nums">
                      {formatPrice(order.totals.total, settings, currency)}
                    </span>
                  </div>
                </div>

                <p className="break-all rounded-xl border border-foreground/15 bg-card px-4 py-3 text-xs text-foreground/80">
                  Order key <span className="font-semibold text-foreground">{order.orderKey}</span>
                </p>

                <div className="flex flex-col gap-3">
                  <Link
                    href={trackHref}
                    className={cn(buttonVariants({ size: "lg" }), "w-full")}
                  >
                    Track this order
                  </Link>
                  <Link
                    href="/products"
                    className={cn(
                      buttonVariants({ size: "lg", variant: "outline" }),
                      "w-full border-foreground/25 text-foreground",
                    )}
                  >
                    Continue shopping
                  </Link>
                </div>

                {settings.contact.email || settings.contact.phone ? (
                  <p className="text-sm text-foreground/80">
                    Questions?{" "}
                    {settings.contact.email ? (
                      <a
                        className="font-semibold text-foreground underline underline-offset-2"
                        href={`mailto:${settings.contact.email}`}
                      >
                        {settings.contact.email}
                      </a>
                    ) : null}
                    {settings.contact.email && settings.contact.phone ? " or " : null}
                    {settings.contact.phone ? (
                      <span className="font-semibold text-foreground">{settings.contact.phone}</span>
                    ) : null}
                  </p>
                ) : null}
              </aside>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

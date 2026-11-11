"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Gift,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { StoreImage } from "@/components/StoreImage";
import { BrandLogo } from "@/components/BrandLogo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentBrandIcon } from "@/components/PaymentBrandIcon";
import { AffirmPayment, PayPalPayment, ReignPayment } from "@/components/PaymentStep";
import {
  ExpressCheckoutRow,
  StripeCardCheckout,
  StripeCheckoutProvider,
  type WalletPayer,
  type WalletQuote,
} from "@/components/StripeOnePageCheckout";
import { iconsForCheckoutMethods } from "@/lib/checkout-icons";
import { useCartStore } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { formatPrice } from "@/lib/format";
import { emptyAddress, emptyStoreCart } from "@/lib/api/map-cart";
import {
  completeCheckoutAction,
  createCheckoutSessionAction,
  getCheckoutOptionsAction,
} from "@/app/actions/checkout";
import {
  applyCouponAction,
  removeCouponAction,
  removeCartItemAction,
  selectShippingRateAction,
  updateCartItemAction,
  updateCustomerAction,
} from "@/app/actions/cart";
import { unwrapCart, unwrapResult } from "@/lib/cart-result";
import { toStripeMinor } from "@/lib/stripe-amount";
import {
  parseStripeShippingRateId,
  splitPersonName,
  stripeShippingRateId,
} from "@/lib/stripe-address";
import type {
  Address,
  CheckoutPaymentKind,
  CheckoutPaymentMethod,
  CheckoutSessionResult,
  CountryOption,
  StoreCart,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-store";
import { userErrorMessage } from "@/lib/user-error";

type StartedCheckout =
  | { ok: true; session: CheckoutSessionResult }
  | { ok: false; message: string };

function addressFromCart(source: Address, fallbackCountry: string): Address {
  return {
    ...emptyAddress(),
    ...source,
    country: source.country || fallbackCountry,
  };
}

function buildCustomerNote(isGift: boolean, note: string) {
  const parts: string[] = [];
  if (isGift) parts.push("Gift order: skip prices on the packing slip.");
  if (note.trim()) parts.push(note.trim());
  return parts.join("\n");
}

function addressReady(address: Address) {
  return Boolean(
    address.address1.trim() &&
      address.city.trim() &&
      address.postcode.trim() &&
      address.country.trim(),
  );
}

function chargeMinor(total: number, currency: string) {
  try {
    return toStripeMinor(total, currency || "usd");
  } catch {
    return 0;
  }
}

function blockToAddress(
  block: NonNullable<WalletPayer["billing"]>,
  email: string,
  phone: string,
  fallback: Address,
): Address {
  const name = splitPersonName(block.name);
  return {
    ...emptyAddress(),
    ...fallback,
    firstName: name.firstName || fallback.firstName || "Customer",
    lastName: name.lastName || fallback.lastName || "-",
    address1: block.line1,
    address2: block.line2,
    city: block.city,
    state: block.state,
    postcode: block.postcode,
    country: block.country,
    email: email || fallback.email,
    phone: phone || fallback.phone,
  };
}

function methodLabel(kind: CheckoutPaymentKind) {
  if (kind === "stripe" || kind === "reign") return "Credit card";
  if (kind === "paypal") return "PayPal";
  if (kind === "affirm") return "Affirm";
  return "Afterpay";
}

export function CheckoutPage() {
  const router = useRouter();
  const { settings } = useStore();
  const cart = useCartStore((state) => state.cart);
  const setCart = useCartStore((state) => state.setCart);
  const setOpen = useCartStore((state) => state.setOpen);
  const [shipping, setShipping] = useState<Address>(emptyAddress());
  const [billing, setBilling] = useState<Address>(emptyAddress());
  const [same, setSame] = useState(true);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [mockPayment, setMockPayment] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<CheckoutPaymentMethod[]>(
    [],
  );
  const [paymentKind, setPaymentKind] = useState<CheckoutPaymentKind | "">("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [affirmPublicKey, setAffirmPublicKey] = useState("");
  const [affirmEnv, setAffirmEnv] = useState<"sandbox" | "live">("sandbox");
  const [reign, setReign] = useState({ publishableKey: "", scriptSrc: "", scriptIntegrity: "" });
  const [isGift, setIsGift] = useState(false);
  const [sellerNote, setSellerNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const syncKey = useRef("");
  const ratesInflight = useRef<Promise<void> | null>(null);
  const payRef = useRef<(() => void) | null>(null);
  const shippingRef = useRef(shipping);
  const billingRef = useRef(billing);
  const sameRef = useRef(same);
  useEffect(() => {
    shippingRef.current = shipping;
    billingRef.current = billing;
    sameRef.current = same;
  }, [shipping, billing, same]);

  useEffect(() => {
    let cancelled = false;
    getCheckoutOptionsAction()
      .then(unwrapResult)
      .then((options) => {
        if (cancelled) return;
        setCart(options.cart);
        setCountries(options.countries);
        setMockPayment(options.mockPayment);
        setPaymentMethods(options.paymentMethods);
        setStripePublishableKey(options.stripePublishableKey);
        setPaypalClientId(options.paypalClientId);
        setAffirmPublicKey(options.affirmPublicKey);
        setAffirmEnv(options.affirmEnv);
        setReign({
          publishableKey: options.reignPublishableKey,
          scriptSrc: options.reignScriptSrc,
          scriptIntegrity: options.reignScriptIntegrity,
        });
        setPaymentKind((current) =>
          options.paymentMethods.some((method) => method.kind === current)
            ? current
            : options.paymentMethods[0]?.kind || "",
        );
        setShipping(
          addressFromCart(options.cart.shippingAddress, options.defaultCountry),
        );
        setBilling(
          addressFromCart(options.cart.billingAddress, options.defaultCountry),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrors({
            form: userErrorMessage(error, "Could not load checkout."),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setCart]);

  async function refreshRates(nextShipping = shippingRef.current) {
    if (!addressReady(nextShipping)) return;
    const currentBilling = billingRef.current;
    const billingSame = sameRef.current;
    const key = [
      nextShipping.address1,
      nextShipping.address2,
      nextShipping.city,
      nextShipping.state,
      nextShipping.postcode,
      nextShipping.country,
    ].join("|");
    if (key === syncKey.current) return;
    syncKey.current = key;
    const nextBilling = billingSame
      ? {
          ...nextShipping,
          email: nextShipping.email || currentBilling.email,
          phone: nextShipping.phone || currentBilling.phone,
        }
      : currentBilling;
    const task = (async () => {
      try {
        const next = unwrapCart(
          await updateCustomerAction({
            shipping: nextShipping,
            billing: nextBilling,
          }),
        );
        setCart(next);
      } catch {
        syncKey.current = "";
      }
    })();
    ratesInflight.current = task;
    try {
      await task;
    } finally {
      if (ratesInflight.current === task) ratesInflight.current = null;
    }
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!shipping.firstName.trim()) next.firstName = "First name is required.";
    if (!shipping.lastName.trim()) next.lastName = "Last name is required.";
    if (!shipping.address1.trim()) next.address1 = "Address is required.";
    if (!shipping.city.trim()) next.city = "City is required.";
    if (!shipping.postcode.trim()) next.postcode = "Postal code is required.";
    if (!shipping.country.trim()) next.country = "Country is required.";
    if (stateOptions.length && !shipping.state.trim()) {
      next.state = "State is required.";
    }
    const email = (same ? shipping.email : billing.email).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function billingAddress() {
    if (same) {
      return {
        ...shipping,
        email: shipping.email || billing.email,
        phone: shipping.phone || billing.phone,
      };
    }
    return {
      ...shipping,
      ...billing,
      firstName: billing.firstName || shipping.firstName,
      lastName: billing.lastName || shipping.lastName,
      address1: billing.address1 || shipping.address1,
      address2: billing.address2 || shipping.address2,
      city: billing.city || shipping.city,
      state: billing.state || shipping.state,
      postcode: billing.postcode || shipping.postcode,
      country: billing.country || shipping.country,
      email: billing.email || shipping.email,
      phone: billing.phone || shipping.phone,
    };
  }

  async function startCheckout(input: {
    kind: CheckoutPaymentKind | "mock";
    shipping: Address;
    billing: Address;
    same: boolean;
    skipValidation?: boolean;
    rateId?: string | null;
  }): Promise<StartedCheckout> {
    if (!input.skipValidation && !validate()) {
      return { ok: false, message: "Check the highlighted fields." };
    }
    if (!cart.items.length) {
      return { ok: false, message: "Your cart is empty." };
    }
    try {
      const pendingRates = ratesInflight.current;
      if (pendingRates) await pendingRates;
      const shipping = {
        ...input.shipping,
        email: input.shipping.email || input.billing.email,
      };
      const billing = {
        ...input.billing,
        email: input.billing.email || shipping.email,
        firstName: input.billing.firstName || shipping.firstName,
        lastName: input.billing.lastName || shipping.lastName,
      };
      let nextCart = unwrapCart(
        await updateCustomerAction({
          shipping,
          billing,
        }),
      );
      const parsedRate = input.rateId ? parseStripeShippingRateId(input.rateId) : null;
      if (parsedRate) {
        nextCart = unwrapCart(await selectShippingRateAction(parsedRate));
      } else if (
        nextCart.needsShipping &&
        !nextCart.shippingRates.some((rate) => rate.selected)
      ) {
        const first = nextCart.shippingRates[0];
        if (!first) {
          return {
            ok: false,
            message: "No shipping methods are available for this address yet.",
          };
        }
        nextCart = unwrapCart(
          await selectShippingRateAction({
            packageId: first.packageId,
            rateId: first.rateId,
          }),
        );
      }
      setCart(nextCart);
      const session = unwrapResult(
        await createCheckoutSessionAction({
          shipping,
          billing,
          billingSameAsShipping: input.same,
          paymentKind: input.kind === "mock" ? undefined : input.kind,
          customerNote: buildCustomerNote(isGift, sellerNote),
        }),
      );
      if (
        session.paymentKind !== "mock" &&
        input.kind !== "mock" &&
        session.paymentKind !== input.kind
      ) {
        return {
          ok: false,
          message: "Could not start the selected payment method. Try again.",
        };
      }
      setCart(session.cart);
      return { ok: true, session };
    } catch (error) {
      return {
        ok: false,
        message: userErrorMessage(
          error,
          "Could not start checkout. Check your details and try again.",
        ),
      };
    }
  }

  function failStart(message: string) {
    if (message) setErrors((current) => ({ ...current, form: message }));
  }

  async function quoteWallet(input: {
    name: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  }): Promise<WalletQuote | null> {
    const name = splitPersonName(input.name);
    const base = shippingRef.current;
    const nextShipping: Address = {
      ...emptyAddress(),
      ...base,
      firstName: name.firstName || base.firstName || "Customer",
      lastName: name.lastName || base.lastName || "-",
      address1: base.address1.trim() || "Address",
      city: input.city,
      state: input.state,
      postcode: input.postcode,
      country: input.country,
      email: (sameRef.current ? base.email : billingRef.current.email) || base.email,
    };
    let priced = unwrapCart(
      await updateCustomerAction({
        shipping: nextShipping,
        billing: { ...nextShipping, email: nextShipping.email },
      }),
    );
    if (priced.needsShipping && !priced.shippingRates.length) return null;
    if (priced.needsShipping) {
      const selected =
        priced.shippingRates.find((rate) => rate.selected) ||
        priced.shippingRates[0];
      if (selected && !selected.selected) {
        priced = unwrapCart(
          await selectShippingRateAction({
            packageId: selected.packageId,
            rateId: selected.rateId,
          }),
        );
      }
    }
    setCart(priced);
    const totalMinor = chargeMinor(priced.totals.total, priced.totals.currency);
    if (totalMinor < 1) return null;
    return {
      totalMinor,
      rates: priced.shippingRates.map((rate) => ({
        id: stripeShippingRateId(rate.packageId, rate.rateId),
        amount: toStripeMinor(rate.price, priced.totals.currency),
        displayName: rate.name,
      })),
    };
  }

  async function selectWalletRate(rateId: string) {
    const parsed = parseStripeShippingRateId(rateId);
    if (!parsed) return null;
    const next = unwrapCart(await selectShippingRateAction(parsed));
    setCart(next);
    const minor = chargeMinor(next.totals.total, next.totals.currency);
    return minor >= 1 ? minor : null;
  }

  function payerAddresses(payer: WalletPayer) {
    const nextShipping = blockToAddress(
      payer.shipping,
      payer.email,
      payer.phone,
      shippingRef.current,
    );
    const nextBilling = payer.billing
      ? blockToAddress(payer.billing, payer.email, payer.phone, billingRef.current)
      : {
          ...nextShipping,
          email: payer.email || nextShipping.email,
          phone: payer.phone || nextShipping.phone,
        };
    return { shipping: nextShipping, billing: nextBilling, same: !payer.billing };
  }

  async function syncWallet(payer: WalletPayer) {
    const addresses = payerAddresses(payer);
    setShipping(addresses.shipping);
    setBilling(addresses.billing);
    setSame(addresses.same);
    let priced = unwrapCart(
      await updateCustomerAction({
        shipping: addresses.shipping,
        billing: addresses.billing,
      }),
    );
    if (payer.rateId) {
      const parsed = parseStripeShippingRateId(payer.rateId);
      if (parsed) priced = unwrapCart(await selectShippingRateAction(parsed));
    } else if (
      priced.needsShipping &&
      !priced.shippingRates.some((rate) => rate.selected) &&
      priced.shippingRates[0]
    ) {
      const first = priced.shippingRates[0];
      priced = unwrapCart(
        await selectShippingRateAction({
          packageId: first.packageId,
          rateId: first.rateId,
        }),
      );
    }
    setCart(priced);
    if (priced.needsShipping && !priced.shippingRates.some((rate) => rate.selected)) {
      return null;
    }
    const minor = chargeMinor(priced.totals.total, priced.totals.currency);
    return minor >= 1 ? minor : null;
  }

  async function createWalletSession(payer: WalletPayer) {
    const addresses = payerAddresses(payer);
    const started = await startCheckout({
      kind: "stripe",
      ...addresses,
      skipValidation: true,
      rateId: payer.rateId,
    });
    if (!started.ok) {
      failStart(started.message);
      return null;
    }
    return started.session;
  }

  async function createCardSession() {
    const started = await startCheckout({
      kind: "stripe",
      shipping,
      billing: billingAddress(),
      same,
      skipValidation: true,
    });
    if (!started.ok) {
      failStart(started.message);
      return null;
    }
    return started.session;
  }

  function finishPaid(result: { orderId: string; orderKey: string; email: string }) {
    setCart(emptyStoreCart());
    toast({
      title: "Order completed",
      description: "Kindly check your email for the order details and tracking link.",
    });
    router.push(
      `/order/${result.orderId}?key=${encodeURIComponent(result.orderKey)}&email=${encodeURIComponent(result.email)}`,
    );
  }

  async function paySeparate(
    kind: CheckoutPaymentKind | "mock",
  ): Promise<CheckoutSessionResult | null> {
    setPaying(true);
    setErrors((current) => ({ ...current, form: "" }));
    try {
      const started = await startCheckout({
        kind,
        shipping,
        billing: billingAddress(),
        same,
      });
      if (!started.ok) {
        failStart(started.message);
        return null;
      }
      return started.session;
    } finally {
      setPaying(false);
    }
  }

  async function payAfterpay() {
    const session = await paySeparate("afterpay");
    if (!session?.redirectUrl) {
      if (session) {
        setErrors((current) => ({
          ...current,
          form: "Afterpay is not available right now.",
        }));
      }
      return;
    }
    window.location.assign(session.redirectUrl);
  }

  async function payMock() {
    const session = await paySeparate("mock");
    if (!session) return;
    setPaying(true);
    try {
      const result = unwrapResult(
        await completeCheckoutAction({
          orderId: session.orderId,
          orderKey: session.orderKey,
          paymentIntentId: session.clientSecret,
        }),
      );
      finishPaid(result);
    } catch (error) {
      setErrors({
        form: userErrorMessage(error, "Could not complete the development checkout."),
      });
    } finally {
      setPaying(false);
    }
  }

  async function chooseRate(packageId: number, rateId: string) {
    try {
      setCart(unwrapCart(await selectShippingRateAction({ packageId, rateId })));
    } catch (error) {
      setErrors({
        form: userErrorMessage(error, "Could not select shipping."),
      });
    }
  }

  const countryOptions = countries.map((country) => ({
    value: country.code,
    label: country.name,
  }));
  const countryCodes = countries
    .map((country) => country.code.trim().toUpperCase())
    .filter((code) => code.length === 2);
  const selectedCountry = countries.find(
    (country) => country.code === shipping.country,
  );
  const stateOptions = (selectedCountry?.states ?? []).map((state) => ({
    value: state.code,
    label: state.name,
  }));
  const shippingReady = addressReady(shipping);
  const showRates = cart.needsShipping && cart.shippingRates.length > 0;
  const minor = chargeMinor(cart.totals.total, cart.totals.currency);
  const stripeReady =
    !mockPayment &&
    Boolean(stripePublishableKey) &&
    paymentMethods.some((method) => method.kind === "stripe") &&
    minor >= 1;
  const severalMethods = paymentMethods.length > 1;
  const email = (same ? shipping.email : billing.email).trim();
  const payBilling = billingAddress();
  const walletRates = cart.shippingRates.map((rate) => ({
    id: stripeShippingRateId(rate.packageId, rate.rateId),
    amount: chargeMinor(rate.price, cart.totals.currency),
    displayName: rate.name,
  }));

  const billingBlock = (
    <div className="space-y-3">
    {!mockPayment ? (
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-accent"
          checked={same}
          onChange={(event) => setSame(event.target.checked)}
        />
        Use shipping address as billing address
      </label>
    ) : null}
    {!same && !mockPayment ? (
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="billing-email"
          label="Billing email"
          type="email"
          value={billing.email}
          error={errors.email}
          onChange={(value) => setBilling({ ...billing, email: value })}
        />
        <Field
          id="billing-phone"
          label="Billing phone"
          value={billing.phone}
          onChange={(value) => setBilling({ ...billing, phone: value })}
        />
        <Field
          id="billing-address"
          className="col-span-2"
          label="Billing address"
          value={billing.address1}
          onChange={(value) => setBilling({ ...billing, address1: value })}
        />
        <Field
          id="billing-city"
          label="Billing city"
          value={billing.city}
          onChange={(value) => setBilling({ ...billing, city: value })}
        />
        <Field
          id="billing-postcode"
          label="Billing postal code"
          value={billing.postcode}
          onChange={(value) => setBilling({ ...billing, postcode: value })}
        />
      </div>
    ) : null}
    </div>
  );

  const stripeCardShown = paymentKind === "stripe" && stripeReady;

  function stripeCard(wallets: "auto" | "never") {
    return (
      <StripeCardCheckout
        wallets={wallets}
        amountMinor={minor}
        billing={payBilling}
        email={email}
        disabled={!cart.items.length}
        payRef={payRef}
        canPay={validate}
        onCreate={createCardSession}
        onPaid={finishPaid}
        onError={(message) => setErrors({ form: message })}
      >
        {billingBlock}
      </StripeCardCheckout>
    );
  }

  const page = (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,42%)]">
      <div className="min-w-0">
        {!cart.items.length ? (
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-[440px] text-center">
              <Link href="/" aria-label={settings.name} className="inline-flex">
                <BrandLogo heightClass="h-8" />
              </Link>
              <span className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-muted text-foreground">
                <ShoppingBag className="size-6" aria-hidden />
              </span>
              <h1 className="font-display mt-6 text-[28px] leading-tight tracking-tight">
                Your cart is empty
              </h1>
              <p className="mx-auto mt-3 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
                Add something you like, then come back here to check out.
              </p>
              <Link
                href="/products"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-8 h-12 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground hover:bg-accent/90",
                )}
              >
                Browse products
              </Link>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[560px] px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
            <div className="mb-8 flex items-center justify-between gap-3">
              <Link href="/" aria-label={settings.name}>
                <BrandLogo heightClass="h-7 max-w-[9rem]" />
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm text-accent"
                onClick={() => setOpen(true)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Cart
              </button>
            </div>

            <button
              type="button"
              className="mb-6 flex w-full items-center justify-between gap-3 bg-muted px-4 py-4 text-sm lg:hidden"
              onClick={() => setShowSummary((open) => !open)}
            >
              <span className="flex items-center gap-2 font-medium text-accent">
                {showSummary ? "Hide" : "Show"} order summary
                <ChevronDown
                  className={cn("size-4 transition-transform", showSummary && "rotate-180")}
                />
              </span>
              <span className="font-medium tabular-nums">
                {formatPrice(cart.totals.total, settings, cart.totals.currency)}
              </span>
            </button>
            {showSummary ? (
              <div className="mb-8 bg-muted p-4 lg:hidden">
                <OrderSummary cart={cart} />
              </div>
            ) : null}

            <form
              className="space-y-8"
              onSubmit={(event) => {
                event.preventDefault();
                if (mockPayment) void payMock();
                else if (paymentKind === "stripe") payRef.current?.();
              }}
            >
              {stripeReady ? (
                <ExpressCheckoutRow
                  needsShipping={cart.needsShipping}
                  countryCodes={countryCodes}
                  deliveryCountry={shipping.country}
                  initialRates={walletRates}
                  businessName={settings.name}
                  onQuoteShipping={quoteWallet}
                  onSelectRate={selectWalletRate}
                  onSync={syncWallet}
                  onCreate={createWalletSession}
                  onPaid={finishPaid}
                  onError={(message) => setErrors({ form: message })}
                />
              ) : null}

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Contact</h2>
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={same ? shipping.email : billing.email}
                  error={errors.email}
                  onChange={(value) => {
                    if (same) setShipping({ ...shipping, email: value });
                    else setBilling({ ...billing, email: value });
                  }}
                />
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Delivery</h2>
                <div className="grid min-w-0 grid-cols-2 gap-3">
                  {countryOptions.length ? (
                    <CheckoutSelect
                      className="col-span-2"
                      id="country"
                      label="Country/Region"
                      value={shipping.country}
                      options={countryOptions}
                      onChange={(value) => {
                        const next = { ...shipping, country: value, state: "" };
                        setShipping(next);
                        void refreshRates(next);
                      }}
                    />
                  ) : (
                    <Field
                      className="col-span-2"
                      id="country"
                      label="Country/Region"
                      autoComplete="country"
                      value={shipping.country}
                      error={errors.country}
                      onChange={(value) => setShipping({ ...shipping, country: value })}
                      onBlur={() => void refreshRates()}
                    />
                  )}
                  <Field
                    id="first-name"
                    label="First name"
                    autoComplete="given-name"
                    value={shipping.firstName}
                    error={errors.firstName}
                    onChange={(value) => setShipping({ ...shipping, firstName: value })}
                  />
                  <Field
                    id="last-name"
                    label="Last name"
                    autoComplete="family-name"
                    value={shipping.lastName}
                    error={errors.lastName}
                    onChange={(value) => setShipping({ ...shipping, lastName: value })}
                  />
                  <Field
                    className="col-span-2"
                    id="address1"
                    label="Address"
                    autoComplete="address-line1"
                    value={shipping.address1}
                    error={errors.address1}
                    onChange={(value) => setShipping({ ...shipping, address1: value })}
                    onBlur={() => void refreshRates()}
                  />
                  <Field
                    className="col-span-2"
                    id="address2"
                    label="Apartment, suite, etc. (optional)"
                    autoComplete="address-line2"
                    value={shipping.address2}
                    onChange={(value) => setShipping({ ...shipping, address2: value })}
                    onBlur={() => void refreshRates()}
                  />
                  <Field
                    id="postcode"
                    label="Postal code"
                    autoComplete="postal-code"
                    value={shipping.postcode}
                    error={errors.postcode}
                    onChange={(value) => setShipping({ ...shipping, postcode: value })}
                    onBlur={() => void refreshRates()}
                  />
                  <Field
                    id="city"
                    label="City"
                    autoComplete="address-level2"
                    value={shipping.city}
                    error={errors.city}
                    onChange={(value) => setShipping({ ...shipping, city: value })}
                    onBlur={() => void refreshRates()}
                  />
                  {stateOptions.length ? (
                    <CheckoutSelect
                      className="col-span-2"
                      id="state"
                      label="State / Province"
                      value={shipping.state}
                      error={errors.state}
                      options={stateOptions}
                      onChange={(value) => {
                        const next = { ...shipping, state: value };
                        setShipping(next);
                        void refreshRates(next);
                      }}
                    />
                  ) : (
                    <Field
                      className="col-span-2"
                      id="state"
                      label="State / Province"
                      autoComplete="address-level1"
                      value={shipping.state}
                      error={errors.state}
                      onChange={(value) => setShipping({ ...shipping, state: value })}
                      onBlur={() => void refreshRates()}
                    />
                  )}
                  <Field
                    className="col-span-2"
                    id="phone"
                    label="Phone (optional)"
                    autoComplete="tel"
                    value={shipping.phone}
                    onChange={(value) => setShipping({ ...shipping, phone: value })}
                  />
                </div>
                <label className="flex items-start gap-2.5 pt-1 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-accent"
                    checked={isGift}
                    onChange={(event) => setIsGift(event.target.checked)}
                  />
                  <span className="flex items-start gap-1.5 leading-snug text-muted-foreground">
                    <Gift className="mt-0.5 size-3.5 text-accent" aria-hidden />
                    This is a gift. Prices stay off the packing slip.
                  </span>
                </label>
                {showNote ? (
                  <Field
                    id="seller-note"
                    label="Note for the seller"
                    value={sellerNote}
                    onChange={setSellerNote}
                  />
                ) : (
                  <button
                    type="button"
                    className="text-sm text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
                    onClick={() => setShowNote(true)}
                  >
                    + Add a note for the seller
                  </button>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Shipping method</h2>
                {!shippingReady ? (
                  <p className="rounded-md bg-muted px-4 py-5 text-center text-sm text-muted-foreground">
                    Enter your shipping address to view available shipping methods.
                  </p>
                ) : showRates ? (
                  <div className="overflow-hidden rounded-md border border-border bg-background">
                    {cart.shippingRates.map((rate, index) => (
                      <label
                        key={`${rate.packageId}-${rate.rateId}`}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-sm",
                          index > 0 && "border-t border-border",
                          rate.selected && "bg-accent/10",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex size-4 items-center justify-center rounded-full border-2",
                              rate.selected ? "border-accent" : "border-foreground/25",
                            )}
                          >
                            {rate.selected ? (
                              <span className="size-2 rounded-full bg-accent" />
                            ) : null}
                          </span>
                          <input
                            type="radio"
                            name="shipping-rate"
                            className="sr-only"
                            checked={rate.selected}
                            onChange={() => void chooseRate(rate.packageId, rate.rateId)}
                          />
                          {rate.name}
                        </span>
                        <span className={cn("tabular-nums", rate.price <= 0 && "font-medium")}>
                          {rate.price <= 0
                            ? "Free"
                            : formatPrice(rate.price, settings, cart.totals.currency)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No shipping methods are available for this address yet.
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">Payment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All transactions are secure and encrypted.
                  </p>
                </div>
                {mockPayment ? (
                  <p className="rounded-md bg-muted px-4 py-4 text-sm">
                    Development checkout is on. No card will be charged.
                  </p>
                ) : !paymentMethods.length ? (
                  <p className="rounded-md border border-border bg-muted px-4 py-4 text-sm font-medium">
                    No payment methods are turned on for this store.
                  </p>
                ) : severalMethods ? (
                  <div className="overflow-hidden rounded-md border border-border">
                    {paymentMethods.map((method, index) => {
                      const selected = paymentKind === method.kind;
                      const icons = iconsForCheckoutMethods(
                        [method],
                        settings.productPage?.stripeCardBrands,
                      );
                      return (
                        <div
                          key={method.kind}
                          className={cn(index > 0 && "border-t border-border")}
                        >
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 px-4 py-3.5",
                              selected && "bg-accent/10",
                            )}
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              className="sr-only"
                              checked={selected}
                              onChange={() => setPaymentKind(method.kind)}
                            />
                            <span
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                                selected ? "border-accent" : "border-foreground/30",
                              )}
                              aria-hidden
                            >
                              {selected ? (
                                <span className="size-2 rounded-full bg-accent" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium">
                              {methodLabel(method.kind)}
                            </span>
                            <span className="flex max-w-[46%] shrink-0 flex-wrap justify-end gap-1">
                              {icons.slice(0, 4).map((icon) => (
                                <PaymentBrandIcon
                                  key={icon.slug}
                                  slug={icon.slug}
                                  label={icon.label}
                                />
                              ))}
                            </span>
                          </label>
                          {selected && method.kind === "stripe" && stripeReady ? (
                            <div className="border-t border-border bg-background px-4 py-4">
                              {stripeCard("never")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : stripeReady && paymentKind === "stripe" ? (
                  stripeCard("auto")
                ) : null}
                {errors.form ? (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.form}
                  </p>
                ) : null}
              </section>

              {!mockPayment && !stripeCardShown ? billingBlock : null}

              {mockPayment ? (
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground hover:bg-accent/90"
                  disabled={paying || !cart.items.length}
                  aria-busy={paying}
                >
                  {paying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Place order (dev)
                </Button>
              ) : stripeCardShown ? null : paymentKind === "paypal" ? (
                <PayPalPayment
                  amount={cart.totals.total}
                  currency={cart.totals.currency}
                  orderId=""
                  orderKey=""
                  clientSecret=""
                  paypalClientId={paypalClientId}
                  canStart={validate}
                  prepare={async () => {
                    const session = await paySeparate("paypal");
                    if (!session) return null;
                    return {
                      orderId: session.orderId,
                      orderKey: session.orderKey,
                      paypalOrderId: session.clientSecret,
                    };
                  }}
                  onPaid={finishPaid}
                  onError={(message) => setErrors({ form: message })}
                />
              ) : paymentKind === "affirm" ? (
                <AffirmPayment
                  amount={cart.totals.total}
                  currency={cart.totals.currency}
                  orderId=""
                  orderKey=""
                  email={email}
                  shipping={shipping}
                  billing={payBilling}
                  affirmPublicKey={affirmPublicKey}
                  affirmEnv={affirmEnv}
                  prepare={async () => {
                    const session = await paySeparate("affirm");
                    if (!session) return null;
                    return {
                      orderId: session.orderId,
                      orderKey: session.orderKey,
                      amount: session.amount,
                      currency: session.currency,
                      email: session.email,
                    };
                  }}
                  onPaid={finishPaid}
                  onError={(message) => setErrors({ form: message })}
                />
              ) : paymentKind === "reign" ? (
                <ReignPayment
                  amount={cart.totals.total}
                  currency={cart.totals.currency}
                  publishableKey={reign.publishableKey}
                  scriptSrc={reign.scriptSrc}
                  scriptIntegrity={reign.scriptIntegrity}
                  cardholderName={`${payBilling.firstName} ${payBilling.lastName}`.trim()}
                  prepare={async () => {
                    if (!validate()) return null;
                    const session = await paySeparate("reign");
                    if (!session?.reignSessionId) return null;
                    return {
                      orderId: session.orderId,
                      orderKey: session.orderKey,
                      sessionId: session.reignSessionId,
                      clientSecret: session.clientSecret,
                      amount: session.amount,
                      currency: session.currency,
                    };
                  }}
                  onPaid={finishPaid}
                  onError={(message) => setErrors({ form: message })}
                />
              ) : paymentKind === "afterpay" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You will finish this payment on Afterpay, then come back to confirm the order.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground hover:bg-accent/90"
                    disabled={paying || !cart.items.length}
                    aria-busy={paying}
                    onClick={() => void payAfterpay()}
                  >
                    {paying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Continue to Afterpay
                  </Button>
                </div>
              ) : paymentKind === "stripe" ? (
                <p className="text-sm text-muted-foreground">
                  Card payment is not available for this total right now.
                </p>
              ) : null}

              <p className="text-sm text-muted-foreground">
                <Link href="/terms-of-service" className="text-accent underline">
                  Terms and policies
                </Link>
              </p>
            </form>
          </div>
        )}
      </div>

      {cart.items.length ? (
        <aside className="hidden border-border bg-muted lg:block lg:border-l">
          <div className="sticky top-0 mx-auto w-full max-w-[440px] px-8 py-12">
            <OrderSummary cart={cart} />
          </div>
        </aside>
      ) : null}
    </div>
  );

  return (
    <StripeCheckoutProvider
      enabled={stripeReady}
      publishableKey={stripePublishableKey}
      amount={cart.totals.total}
      currency={cart.totals.currency || "usd"}
    >
      {page}
    </StripeCheckoutProvider>
  );
}

const fieldShell =
  "h-12 w-full rounded-md border border-border bg-background px-3.5 text-sm text-foreground shadow-none outline-none placeholder:text-transparent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  className,
  onBlur,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  className?: string;
  onBlur?: () => void;
  autoComplete?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={label}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        className={cn(fieldShell, "peer pt-4")}
      />
      <span className="pointer-events-none absolute top-1.5 left-3.5 text-[11px] text-muted-foreground peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[11px]">
        {label}
      </span>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CheckoutSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  error?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldShell, "appearance-none pr-10", value && "pt-4")}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {value ? (
        <span className="pointer-events-none absolute top-1.5 left-3.5 text-[11px] text-muted-foreground">
          {label}
        </span>
      ) : null}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function OrderSummary({ cart }: { cart: StoreCart }) {
  const { settings } = useStore();
  const setCart = useCartStore((state) => state.setCart);
  const [coupon, setCoupon] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [qtyBusy, setQtyBusy] = useState("");
  const shippingFree = cart.hasCalculatedShipping && cart.totals.shipping <= 0;

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponBusy(true);
    try {
      const next = unwrapCart(await applyCouponAction(coupon));
      setCart(next);
      toast({ title: "Coupon applied", description: coupon.trim() });
      setCoupon("");
    } catch (error) {
      toast({
        title: "Coupon could not be applied",
        description: userErrorMessage(error, "Coupon could not be applied."),
        variant: "error",
      });
    } finally {
      setCouponBusy(false);
    }
  }

  async function removeCoupon(code: string) {
    setCouponBusy(true);
    try {
      setCart(unwrapCart(await removeCouponAction(code)));
      toast({ title: "Coupon removed", description: code });
    } catch (error) {
      toast({
        title: "Coupon could not be removed",
        description: userErrorMessage(error, "Coupon could not be removed."),
        variant: "error",
      });
    } finally {
      setCouponBusy(false);
    }
  }

  async function changeQty(key: string, quantity: number) {
    setQtyBusy(key);
    try {
      setCart(unwrapCart(await updateCartItemAction({ key, quantity })));
    } catch (error) {
      toast({
        title: "Could not update quantity",
        description: userErrorMessage(error, "Could not update quantity."),
        variant: "error",
      });
    } finally {
      setQtyBusy("");
    }
  }

  async function removeItem(key: string, name: string) {
    setQtyBusy(key);
    try {
      setCart(unwrapCart(await removeCartItemAction(key)));
      toast({ title: "Removed from cart", description: name });
    } catch (error) {
      toast({
        title: "Could not remove item",
        description: userErrorMessage(error, "Could not remove item."),
        variant: "error",
      });
    } finally {
      setQtyBusy("");
    }
  }

  return (
    <div>
      <ul className="space-y-4">
        {cart.items.map((item) => (
          <li key={item.key} className="flex items-start gap-4">
            <div className="relative size-16 shrink-0">
              <div className="size-16 overflow-hidden rounded-md border border-border bg-background">
                <StoreImage src={item.image} alt="" sizes="64px" />
              </div>
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-medium text-background">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug break-words">{item.name}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <button
                  type="button"
                  className="px-0.5 disabled:opacity-40"
                  disabled={qtyBusy === item.key || item.quantity <= item.quantityMin}
                  onClick={() => void changeQty(item.key, item.quantity - 1)}
                  aria-label={`Decrease quantity for ${item.name}`}
                >
                  <Minus className="size-3" />
                </button>
                <button
                  type="button"
                  className="px-0.5 disabled:opacity-40"
                  disabled={qtyBusy === item.key || item.quantity >= item.quantityMax}
                  onClick={() => void changeQty(item.key, item.quantity + 1)}
                  aria-label={`Increase quantity for ${item.name}`}
                >
                  <Plus className="size-3" />
                </button>
                <button
                  type="button"
                  className="ml-1 hover:text-foreground hover:underline"
                  disabled={qtyBusy === item.key}
                  onClick={() => void removeItem(item.key, item.name)}
                >
                  Remove
                </button>
              </div>
            </div>
            <span className="shrink-0 text-sm tabular-nums">
              {formatPrice(item.price * item.quantity, settings, cart.totals.currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {showCoupon || cart.coupons.length ? (
          <div className="flex gap-2">
            <Input
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
              placeholder="Discount code"
              aria-label="Discount code"
              className="h-10 rounded-md border-border bg-background"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-md"
              disabled={couponBusy || !coupon.trim()}
              onClick={() => void applyCoupon()}
            >
              Apply
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setShowCoupon(true)}
          >
            Discount code
          </button>
        )}
        {cart.coupons.map((entry) => (
          <div key={entry.code} className="mt-2 flex items-center justify-between text-sm">
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
      </div>
      <div className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">
            {formatPrice(cart.totals.subtotal, settings, cart.totals.currency)}
          </span>
        </div>
        {cart.totals.discount > 0 ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="tabular-nums">
              -{formatPrice(cart.totals.discount, settings, cart.totals.currency)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span className={cn("tabular-nums", !cart.hasCalculatedShipping && "text-muted-foreground")}>
            {!cart.hasCalculatedShipping
              ? "Enter shipping address"
              : shippingFree
                ? "Free"
                : formatPrice(cart.totals.shipping, settings, cart.totals.currency)}
          </span>
        </div>
        {cart.hasCalculatedShipping && cart.totals.tax > 0 ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">
              {formatPrice(cart.totals.tax, settings, cart.totals.currency)}
            </span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between pt-1 text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">
            <span className="mr-2 text-xs font-normal text-muted-foreground">
              {(cart.totals.currency || settings.currency || "").toUpperCase()}
            </span>
            {formatPrice(cart.totals.total, settings, cart.totals.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

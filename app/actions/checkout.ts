"use server";

import { headers } from "next/headers";
import {
  cancelUnpaidOrder,
  createPendingOrderFromCart,
  getCountries,
  getDefaultCountry,
  getEnabledCheckoutMethods,
  getOrder,
  markOrderPaid,
  setOrderCustomerNote,
  setOrderMeta,
} from "@/lib/api";
import { captureAffirmCheckout } from "@/lib/affirm";
import {
  createReignSession,
  getReignSession,
  REIGN_SESSION_META,
  reignSessionPaidAmountMatches,
} from "@/lib/reign";
import { captureAfterpayPayment, createAfterpayCheckout } from "@/lib/afterpay";
import { capturePayPalOrder, createPayPalOrder } from "@/lib/paypal";
import { checkoutPublicConfig, getPaymentAccounts } from "@/lib/payment-config";
import {
  getPendingCheckout,
  getStoreCart,
  setPendingCheckout,
  updateStoreCustomer,
  clearStoreCart,
} from "@/lib/api/store-api";
import {
  getStripe,
  isMockPaymentEnabled,
  isMockPaymentIntentId,
  isStripeConfigured,
  mockPaymentIntentId,
  stripeAmountMatches,
  toStripeAmount,
} from "@/lib/stripe";
import { STRIPE_SEPARATE_CHECKOUT_METHODS } from "@/lib/stripe-amount";
import { stripeShippingParams } from "@/lib/stripe-address";
import { publicError, type PublicResult } from "@/lib/cart-result";
import type {
  Address,
  CheckoutDetails,
  CheckoutSessionResult,
  CompleteCheckoutPayload,
  CheckoutPaymentKind,
  CheckoutPaymentMethod,
  CountryOption,
  CreateOrderResult,
  StoreCart,
} from "@/lib/types";

type CheckoutOptions = {
  cart: StoreCart;
  countries: CountryOption[];
  defaultCountry: string;
  mockPayment: boolean;
  paymentMethods: CheckoutPaymentMethod[];
  stripePublishableKey: string;
  paypalClientId: string;
  affirmPublicKey: string;
  affirmEnv: "sandbox" | "live";
  reignPublishableKey: string;
  reignScriptSrc: string;
  reignScriptIntegrity: string;
};

function providerFromRef(ref: string): CheckoutPaymentKind | null {
  if (ref.startsWith("reign:")) return "reign";
  if (ref.startsWith("paypal:")) return "paypal";
  if (ref.startsWith("affirm:")) return "affirm";
  if (ref.startsWith("afterpay:")) return "afterpay";
  if (ref.startsWith("pi_")) return "stripe";
  return null;
}

async function requireStripe() {
  if (!(await isStripeConfigured())) {
    throw new Error("Stripe is not configured. Add a secret key in Admin.");
  }
  return getStripe();
}

async function loadCheckoutOptions(): Promise<CheckoutOptions> {
  const [cart, countries, defaultCountry, paymentMethods, accounts] = await Promise.all([
    getStoreCart(),
    getCountries(),
    getDefaultCountry(),
    getEnabledCheckoutMethods(),
    getPaymentAccounts(),
  ]);
  const publicConfig = checkoutPublicConfig(accounts);
  return {
    cart,
    countries,
    defaultCountry,
    mockPayment: isMockPaymentEnabled(),
    paymentMethods:
      cart.totals.currency.toUpperCase() === "USD"
        ? paymentMethods
        : paymentMethods.filter((method) => method.kind !== "reign"),
    stripePublishableKey: publicConfig.stripePublishableKey,
    paypalClientId: publicConfig.paypalClientId,
    affirmPublicKey: publicConfig.affirmPublicKey,
    affirmEnv: publicConfig.affirmEnv,
    reignPublishableKey: publicConfig.reignPublishableKey,
    reignScriptSrc: publicConfig.reignScriptSrc,
    reignScriptIntegrity: publicConfig.reignScriptIntegrity,
  };
}

export async function getCheckoutOptionsAction(): Promise<PublicResult<CheckoutOptions>> {
  try {
    return { ok: true, data: await loadCheckoutOptions() };
  } catch (error) {
    return publicError(error, "Could not load checkout.");
  }
}

async function abandonPendingIfStale(cartHash: string) {
  const pending = await getPendingCheckout();
  if (!pending) return;
  if (pending.cartHash === cartHash) return;
  const stripe = (await isStripeConfigured()) ? await getStripe() : null;
  if (pending.paymentIntentId?.startsWith("pi_") && stripe) {
    try {
      await stripe.paymentIntents.cancel(pending.paymentIntentId);
    } catch {
      // Already cancelled or succeeded.
    }
  }
  try {
    await cancelUnpaidOrder(pending.orderId);
  } catch {
    // Order may already be gone.
  }
  await setPendingCheckout(null);
}

async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const proto =
    headerList.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "";
}

async function createCardPaymentIntent(input: {
  orderId: string;
  orderKey: string;
  amount: number;
  currency: string;
  email: string;
  shipping: Address;
  existingIntentId?: string;
}) {
  const stripe = await requireStripe();
  const amount = toStripeAmount(input.amount, input.currency);
  const currency = input.currency.trim().toLowerCase();
  const metadata = {
    woo_order_id: input.orderId,
    order_key: input.orderKey,
  };
  const shipping = stripeShippingParams(input.shipping);
  const automatic_payment_methods = {
    enabled: true,
    allow_redirects: "always" as const,
  };
  const excluded_payment_method_types = [...STRIPE_SEPARATE_CHECKOUT_METHODS];

  if (input.existingIntentId?.startsWith("pi_")) {
    try {
      const existing = await stripe.paymentIntents.retrieve(input.existingIntentId);
      const sameOrder = existing.metadata?.woo_order_id === input.orderId;
      if (existing.status === "succeeded" && sameOrder) return existing;
      if (
        sameOrder &&
        existing.client_secret &&
        existing.automatic_payment_methods?.enabled &&
        existing.status !== "canceled"
      ) {
        return await stripe.paymentIntents.update(existing.id, {
          amount,
          currency,
          metadata,
          receipt_email: input.email || undefined,
          shipping,
          excluded_payment_method_types,
        });
      }
      if (existing.status !== "canceled" && existing.status !== "succeeded") {
        try {
          await stripe.paymentIntents.cancel(existing.id);
        } catch {
          // Already cancelled or no longer cancellable.
        }
      }
    } catch {
      // Create a new intent below.
    }
  }

  return stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods,
    excluded_payment_method_types,
    metadata,
    receipt_email: input.email || undefined,
    shipping,
  });
}

const sessionHits = new Map<string, { count: number; resetAt: number }>();
const SESSION_WINDOW_MS = 60_000;
const SESSION_MAX_HITS = 10;

async function checkoutRateLimited() {
  const headerList = await headers();
  const key =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "local";
  const now = Date.now();
  if (sessionHits.size > 5000) {
    for (const [entry, value] of sessionHits) {
      if (value.resetAt < now) sessionHits.delete(entry);
    }
  }
  const current = sessionHits.get(key);
  if (!current || current.resetAt < now) {
    sessionHits.set(key, { count: 1, resetAt: now + SESSION_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > SESSION_MAX_HITS;
}

async function createCheckoutSession(
  details: CheckoutDetails,
): Promise<CheckoutSessionResult> {
  if (await checkoutRateLimited()) {
    throw new Error("Too many checkout attempts. Please wait a minute and try again.");
  }
  const mockPayment = isMockPaymentEnabled();
  const methods = mockPayment ? [] : await getEnabledCheckoutMethods();
  const selected = details.paymentKind
    ? methods.find((method) => method.kind === details.paymentKind)
    : methods[0];
  if (!mockPayment && !selected) {
    throw new Error(
      details.paymentKind
        ? "That payment method is not available."
        : "No payment methods are enabled. Turn one on in Admin.",
    );
  }
  const paymentKind: CheckoutPaymentKind | "mock" = mockPayment
    ? "mock"
    : selected!.kind;
  const billing = details.billingSameAsShipping
    ? { ...details.shipping, email: details.billing.email || details.shipping.email, phone: details.billing.phone || details.shipping.phone }
    : details.billing;
  const cart = await updateStoreCustomer({
    shipping: details.shipping,
    billing,
  });

  if (!cart.items.length) {
    throw new Error("Your cart is empty.");
  }
  if (cart.needsShipping && !cart.shippingRates.some((rate) => rate.selected)) {
    throw new Error("Select a shipping method.");
  }

  await abandonPendingIfStale(cart.cartHash);

  const existing = await getPendingCheckout();
  if (existing && existing.cartHash === cart.cartHash) {
    const order = await getOrder(existing.orderId);
    const orderOk =
      order.status !== "cancelled" && order.status !== "failed";
    if (orderOk && details.customerNote?.trim()) {
      await setOrderCustomerNote(existing.orderId, details.customerNote);
    }
    if (mockPayment && orderOk && isMockPaymentIntentId(existing.paymentIntentId)) {
      return {
        orderId: existing.orderId,
        orderKey: existing.orderKey,
        clientSecret: existing.paymentIntentId,
        amount: Number(order.total) || cart.totals.total,
        currency: order.currency || cart.totals.currency,
        email: billing.email,
        cart,
        mockPayment: true,
        paymentKind: "mock",
      };
    }
    if (!mockPayment && orderOk && paymentKind !== "mock") {
      const storedKind = providerFromRef(existing.paymentIntentId);
      return beginProviderPayment({
        kind: paymentKind,
        orderId: existing.orderId,
        orderKey: existing.orderKey,
        amount: Number(order.total) || cart.totals.total,
        currency: order.currency || cart.totals.currency,
        email: billing.email,
        shipping: cart.shippingAddress,
        billing,
        cart,
        existingRef:
          storedKind === paymentKind ? existing.paymentIntentId : undefined,
      });
    }
  }

  const pending = await createPendingOrderFromCart(cart, {
    mockPayment,
    paymentMethod: selected?.wooId,
    paymentMethodTitle: selected?.title,
    customerNote: details.customerNote,
  });

  if (mockPayment) {
    const paymentIntentId = mockPaymentIntentId(pending.orderId);
    await setPendingCheckout({
      orderId: pending.orderId,
      orderKey: pending.orderKey,
      paymentIntentId,
      cartHash: cart.cartHash,
    });
    return {
      orderId: pending.orderId,
      orderKey: pending.orderKey,
      clientSecret: paymentIntentId,
      amount: pending.total,
      currency: pending.currency,
      email: billing.email,
      cart,
      mockPayment: true,
      paymentKind: "mock",
    };
  }

  if (paymentKind === "mock") {
    throw new Error("Could not start checkout.");
  }
  return beginProviderPayment({
    kind: paymentKind,
    orderId: pending.orderId,
    orderKey: pending.orderKey,
    amount: pending.total,
    currency: pending.currency,
    email: billing.email,
    shipping: cart.shippingAddress,
    billing,
    cart,
  });
}

export async function createCheckoutSessionAction(
  details: CheckoutDetails,
): Promise<PublicResult<CheckoutSessionResult>> {
  try {
    return { ok: true, data: await createCheckoutSession(details) };
  } catch (error) {
    return publicError(error, "Could not start checkout.");
  }
}

async function beginProviderPayment(input: {
  kind: CheckoutPaymentKind;
  orderId: string;
  orderKey: string;
  amount: number;
  currency: string;
  email: string;
  shipping: Address;
  billing: Address;
  cart: StoreCart;
  existingRef?: string;
}): Promise<CheckoutSessionResult> {
  const base = {
    orderId: input.orderId,
    orderKey: input.orderKey,
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    cart: input.cart,
    paymentKind: input.kind,
  };

  if (input.kind === "paypal") {
    const paypalOrderId = await createPayPalOrder({
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
    });
    await setPendingCheckout({
      orderId: input.orderId,
      orderKey: input.orderKey,
      paymentIntentId: `paypal:${paypalOrderId}`,
      cartHash: input.cart.cartHash,
    });
    return { ...base, clientSecret: paypalOrderId };
  }

  if (input.kind === "reign") {
    const previous = input.existingRef?.startsWith("reign:")
      ? input.existingRef.slice("reign:".length)
      : "";
    if (previous) {
      const earlier = await getReignSession(previous).catch(() => null);
      if (earlier?.status === "succeeded" || earlier?.status === "processing") {
        throw new Error(
          "A payment for this order is already being confirmed. Refresh the page in a moment.",
        );
      }
    }
    const session = await createReignSession({
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      shipping: input.shipping,
      billing: input.billing,
      needsShipping: input.cart.needsShipping,
    });
    await setOrderMeta(input.orderId, REIGN_SESSION_META, session.id);
    await setPendingCheckout({
      orderId: input.orderId,
      orderKey: input.orderKey,
      paymentIntentId: `reign:${session.id}`,
      cartHash: input.cart.cartHash,
    });
    return { ...base, clientSecret: session.clientSecret, reignSessionId: session.id };
  }

  if (input.kind === "affirm") {
    await setPendingCheckout({
      orderId: input.orderId,
      orderKey: input.orderKey,
      paymentIntentId: `affirm:${input.orderId}`,
      cartHash: input.cart.cartHash,
    });
    return { ...base, clientSecret: `affirm:${input.orderId}` };
  }

  if (input.kind === "afterpay") {
    const origin = await requestOrigin();
    const confirm = new URL(`/order/${input.orderId}`, origin || "http://localhost:3000");
    confirm.searchParams.set("key", input.orderKey);
    confirm.searchParams.set("email", input.email);
    const cancel = new URL("/checkout", origin || "http://localhost:3000");
    cancel.searchParams.set("afterpay", "cancel");
    const checkout = await createAfterpayCheckout({
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      shipping: input.shipping,
      billing: input.billing,
      confirmUrl: confirm.toString(),
      cancelUrl: cancel.toString(),
    });
    await setPendingCheckout({
      orderId: input.orderId,
      orderKey: input.orderKey,
      paymentIntentId: `afterpay:${checkout.token}`,
      cartHash: input.cart.cartHash,
    });
    return {
      ...base,
      clientSecret: checkout.token,
      redirectUrl: checkout.redirectUrl,
    };
  }

  const intent = await createCardPaymentIntent({
    orderId: input.orderId,
    orderKey: input.orderKey,
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    shipping: input.shipping,
    existingIntentId: input.existingRef,
  });
  if (!intent.client_secret) {
    throw new Error("Could not start Stripe payment.");
  }
  const accounts = await getPaymentAccounts();
  const publishableKey = accounts.stripe.publishableKey.trim();
  const secretKey = accounts.stripe.secretKey.trim();
  const secretLive = secretKey.includes("_live_");
  const publishableLive = publishableKey.includes("_live_");
  if (!publishableKey.startsWith("pk_") || secretLive !== publishableLive) {
    throw new Error(
      "The Stripe publishable key and secret key are not a matching pair. In Admin, use both keys from the same Stripe account.",
    );
  }
  await setPendingCheckout({
    orderId: input.orderId,
    orderKey: input.orderKey,
    paymentIntentId: intent.id,
    cartHash: input.cart.cartHash,
  });
  return {
    ...base,
    clientSecret: intent.client_secret,
    stripePublishableKey: publishableKey,
  };
}

async function finishPaid(
  orderId: string,
  orderKey: string,
  transactionId: string,
  kind: CheckoutPaymentKind,
) {
  const methods = await getEnabledCheckoutMethods();
  const method = methods.find((entry) => entry.kind === kind);
  const paid = await markOrderPaid(orderId, transactionId, {
    paymentMethod: method?.wooId,
    paymentMethodTitle: method?.title,
  });
  try {
    await clearStoreCart();
  } catch {
    // Cart clear is best-effort after payment.
  }
  await setPendingCheckout(null);
  return { ...paid, orderKey: paid.orderKey || orderKey || "" };
}

async function completeCheckout(
  payload: CompleteCheckoutPayload,
): Promise<CreateOrderResult> {
  const orderId = payload.orderId.trim();
  const paymentIntentId = payload.paymentIntentId.trim();
  const orderKey = payload.orderKey.trim();

  if (!orderId || !paymentIntentId) {
    throw new Error("Payment confirmation is incomplete.");
  }

  if (isMockPaymentEnabled() && isMockPaymentIntentId(paymentIntentId)) {
    const pending = await getPendingCheckout();
    if (
      !pending ||
      pending.orderId !== orderId ||
      pending.paymentIntentId !== paymentIntentId
    ) {
      throw new Error("Payment confirmation is incomplete.");
    }
    if (orderKey && pending.orderKey && pending.orderKey !== orderKey) {
      throw new Error("Payment does not match this order.");
    }
    const paid = await markOrderPaid(orderId, paymentIntentId);
    try {
      await clearStoreCart();
    } catch {
      // Cart clear is best-effort after payment.
    }
    await setPendingCheckout(null);
    return { ...paid, orderKey: paid.orderKey || orderKey || "" };
  }

  const provider = payload.provider;

  if (provider === "paypal") {
    const captured = await capturePayPalOrder(paymentIntentId);
    if (captured.orderId && captured.orderId !== orderId) {
      throw new Error("Payment does not match this order.");
    }
    const order = await getOrder(orderId);
    if (Math.abs(captured.amount - Number(order.total || 0)) > 0.05) {
      throw new Error("Payment amount does not match the order.");
    }
    return finishPaid(orderId, orderKey, captured.captureId, "paypal");
  }

  if (provider === "affirm") {
    const pending = await getPendingCheckout();
    if (
      !pending ||
      pending.orderId !== orderId ||
      pending.paymentIntentId !== `affirm:${orderId}`
    ) {
      throw new Error("Payment confirmation is incomplete.");
    }
    const captured = await captureAffirmCheckout({
      checkoutToken: paymentIntentId,
      orderId,
    });
    if (captured.orderId && captured.orderId !== orderId) {
      throw new Error("Payment does not match this order.");
    }
    const order = await getOrder(orderId);
    if (
      captured.amount > 0 &&
      Math.abs(captured.amount - Number(order.total || 0)) > 0.05
    ) {
      throw new Error("Payment amount does not match the order.");
    }
    return finishPaid(orderId, orderKey, captured.chargeId, "affirm");
  }

  if (provider === "reign") {
    const pending = await getPendingCheckout();
    if (
      !pending ||
      pending.orderId !== orderId ||
      pending.paymentIntentId !== `reign:${paymentIntentId}`
    ) {
      throw new Error("Payment confirmation is incomplete.");
    }
    if (orderKey && pending.orderKey && pending.orderKey !== orderKey) {
      throw new Error("Payment does not match this order.");
    }
    const session = await getReignSession(paymentIntentId);
    if (session.status === "processing" || session.status === "requires_action") {
      throw new Error("We are still confirming your payment. Please wait.");
    }
    if (session.status !== "succeeded") {
      throw new Error("Payment has not succeeded yet.");
    }
    const order = await getOrder(orderId);
    if (!reignSessionPaidAmountMatches(session, order.total || 0)) {
      throw new Error("Payment amount does not match the order.");
    }
    return finishPaid(orderId, orderKey, session.id, "reign");
  }

  if (provider === "afterpay") {
    const captured = await captureAfterpayPayment(paymentIntentId, orderId);
    if (captured.orderId && captured.orderId !== orderId) {
      throw new Error("Payment does not match this order.");
    }
    const order = await getOrder(orderId);
    if (
      captured.amount > 0 &&
      Math.abs(captured.amount - Number(order.total || 0)) > 0.05
    ) {
      throw new Error("Payment amount does not match the order.");
    }
    return finishPaid(orderId, orderKey, captured.paymentId, "afterpay");
  }

  const stripe = await requireStripe();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const wooOrderId = intent.metadata?.woo_order_id;
  const metadataKey = intent.metadata?.order_key || "";

  if (wooOrderId !== orderId) {
    throw new Error("Payment does not match this order.");
  }
  if (orderKey && metadataKey && metadataKey !== orderKey) {
    throw new Error("Payment does not match this order.");
  }
  if (intent.status !== "succeeded") {
    throw new Error("Payment has not succeeded yet.");
  }

  const order = await getOrder(orderId);
  if (
    !stripeAmountMatches(
      order.total || 0,
      order.currency || "",
      intent.amount,
      intent.currency,
    )
  ) {
    throw new Error("Payment amount does not match the order.");
  }

  return finishPaid(orderId, orderKey, intent.id, "stripe");
}

export async function completeCheckoutAction(
  payload: CompleteCheckoutPayload,
): Promise<PublicResult<CreateOrderResult>> {
  try {
    return { ok: true, data: await completeCheckout(payload) };
  } catch (error) {
    return publicError(error, "Payment could not be completed.");
  }
}

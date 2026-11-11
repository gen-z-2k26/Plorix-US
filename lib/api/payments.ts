import { isAffirmConfigured } from "@/lib/affirm";
import { isAfterpayConfigured } from "@/lib/afterpay";
import { isPayPalConfigured } from "@/lib/paypal";
import { getPaymentAccounts } from "@/lib/payment-config";
import { isReignConfigured } from "@/lib/reign";
import { isStripeConfigured } from "@/lib/stripe";
import type { CheckoutPaymentKind, CheckoutPaymentMethod } from "@/lib/types";

const KIND_ORDER: CheckoutPaymentKind[] = ["stripe", "reign", "paypal", "affirm", "afterpay"];

const DEFAULT_TITLE: Record<CheckoutPaymentKind, string> = {
  paypal: "PayPal",
  stripe: "Card",
  reign: "Card",
  affirm: "Affirm",
  afterpay: "Afterpay",
};

export async function getEnabledCheckoutMethods(): Promise<
  CheckoutPaymentMethod[]
> {
  const accounts = await getPaymentAccounts();
  const enabled: CheckoutPaymentKind[] = [];
  if (accounts.paypal.enabled && (await isPayPalConfigured())) enabled.push("paypal");
  if (
    accounts.stripe.enabled &&
    (await isStripeConfigured()) &&
    accounts.stripe.publishableKey
  ) {
    enabled.push("stripe");
  }
  if (accounts.affirm.enabled && (await isAffirmConfigured())) enabled.push("affirm");
  if (accounts.afterpay.enabled && (await isAfterpayConfigured())) enabled.push("afterpay");
  if (accounts.reign.enabled && (await isReignConfigured())) enabled.push("reign");
  return KIND_ORDER.filter((kind) => enabled.includes(kind)).map((kind) => ({
    kind,
    wooId: kind,
    title: DEFAULT_TITLE[kind],
  }));
}


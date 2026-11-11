import type { CheckoutPaymentKind, CheckoutPaymentMethod } from "./types.ts";

// The public, non-secret view of the checkout's payment options. The shopping assistant reads it
// to say which options are available right now. It carries only a kind, a display name and
// whether the option is on. No keys, account ids or modes.
export const PUBLIC_METHODS: ReadonlyArray<{
  kind: CheckoutPaymentKind;
  title: string;
}> = [
  { kind: "paypal", title: "PayPal" },
  { kind: "stripe", title: "Card" },
  { kind: "reign", title: "Card" },
  { kind: "affirm", title: "Affirm" },
  { kind: "afterpay", title: "Afterpay" },
];

export type PublicPaymentMethod = {
  kind: CheckoutPaymentKind;
  title: string;
  enabled: boolean;
};

export function publicPaymentMethods(
  enabled: ReadonlyArray<Pick<CheckoutPaymentMethod, "kind">>,
): PublicPaymentMethod[] {
  const on = new Set(enabled.map((method) => method.kind));
  return PUBLIC_METHODS.map((method) => ({
    kind: method.kind,
    title: method.title,
    enabled: on.has(method.kind),
  }));
}

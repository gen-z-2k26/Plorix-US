import type { PaymentIconSlug } from "@/lib/types";

const ART: Partial<Record<PaymentIconSlug, string>> = {
  visa: "/payments/visa.svg",
  mastercard: "/payments/mastercard.svg",
  amex: "/payments/amex.svg",
  discover: "/payments/discover.svg",
  unionpay: "/payments/unionpay.svg",
  paypal: "/payments/paypal.svg",
  afterpay: "/payments/afterpay-badge.svg",
};

export function PaymentBrandIcon({
  slug,
  label,
}: {
  slug: PaymentIconSlug;
  label: string;
}) {
  const src = ART[slug];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      className="h-5 w-auto max-w-[3.25rem] object-contain"
    />
  );
}

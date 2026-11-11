import type {
  CheckoutPaymentMethod,
  PaymentIconSlug,
  PaymentMethodIcon,
} from "@/lib/types";

const LABELS: Record<PaymentIconSlug, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  jcb: "JCB",
  diners: "Diners Club",
  unionpay: "UnionPay",
  paypal: "PayPal",
  "apple-pay": "Apple Pay",
  "google-pay": "Google Pay",
  affirm: "Affirm",
  afterpay: "Afterpay",
  klarna: "Klarna",
  link: "Link",
};

const CARD_DEFAULT: PaymentIconSlug[] = [
  "visa",
  "mastercard",
  "amex",
  "unionpay",
];

const REIGN_BRANDS: PaymentIconSlug[] = ["visa", "mastercard", "amex", "discover"];

export function iconsForCheckoutMethods(
  methods: CheckoutPaymentMethod[],
  cardBrands: PaymentIconSlug[] = CARD_DEFAULT,
): PaymentMethodIcon[] {
  const slugs: PaymentIconSlug[] = [];
  const seen = new Set<PaymentIconSlug>();

  function add(slug: PaymentIconSlug) {
    if (seen.has(slug)) return;
    seen.add(slug);
    slugs.push(slug);
  }

  for (const method of methods) {
    if (method.kind === "stripe") {
      for (const brand of cardBrands.length ? cardBrands : CARD_DEFAULT) {
        add(brand);
      }
    } else if (method.kind === "reign") {
      for (const brand of REIGN_BRANDS) add(brand);
    } else if (method.kind === "paypal") {
      add("paypal");
    } else if (method.kind === "affirm") {
      add("affirm");
    } else if (method.kind === "afterpay") {
      add("afterpay");
    }
  }

  return slugs.map((slug) => ({ slug, label: LABELS[slug] }));
}

/** Public storefront paths, matching https://plorix.us/ */

export const CONTENT_PAGES = [
  { slug: "about-us", title: "About Us" },
  { slug: "our-commitment", title: "Our Commitment" },
  { slug: "contact-us", title: "Contact Us" },
  { slug: "faqs", title: "Frequently Asked Questions" },
  { slug: "order-help-center", title: "Order Help Center" },
  { slug: "track-your-order", title: "Track Your Order" },
  { slug: "shipping-policy", title: "Shipping & Delivery" },
  { slug: "return-and-refund-policy", title: "Returns & Refunds" },
  { slug: "cancellation-policy", title: "Order Cancellations" },
  { slug: "payment-policy", title: "Payment Options" },
  { slug: "buy-now-pay-later", title: "Buy Now, Pay Later" },
  { slug: "warranty", title: "Warranty & Support" },
  { slug: "privacy-policy", title: "Privacy Policy" },
  { slug: "terms-of-service", title: "Terms of Service" },
  { slug: "cookie-policy", title: "Cookie Policy" },
  { slug: "legal-notice", title: "Legal Notice" },
  { slug: "accessibility-statement", title: "Accessibility Statement" },
  { slug: "your-privacy-choices", title: "Your Privacy Choices" },
] as const;

const SKIP_PATHS = new Set([
  "/cart",
  "/checkout",
  "/my-account",
  "/my-account/lost-password",
]);

const PATH_ALIASES: Record<string, string> = {
  "/": "/",
  "/shop": "/products",
  "/shop-all-electronics": "/products",
  "/product-category": "/products",
  "/about": "/about-us",
  "/contact": "/contact-us",
  "/faq": "/faqs",
  "/track-order": "/track-your-order",
  "/privacy": "/privacy-policy",
  "/terms": "/terms-of-service",
};

const STORE_HOSTS = new Set([
  "plorix.us",
  "www.plorix.us",
  "droviia.us",
  "www.droviia.us",
  "orvexo.us",
  "www.orvexo.us",
  "admin.orvexo.us",
]);

export function rewriteStorefrontPath(path: string): string {
  const clean = path.replace(/\/$/, "") || "/";
  if (SKIP_PATHS.has(clean)) return "";
  if (PATH_ALIASES[clean]) return PATH_ALIASES[clean];
  if (clean.startsWith("/product-category")) return "/products";
  return path.startsWith("/") ? clean || "/" : path;
}

export function toStorefrontHref(url: string, wpOrigin?: string | null): string {
  const trimmed = url.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return rewriteStorefrontPath(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    const wpHost = wpOrigin ? new URL(wpOrigin).hostname : "";
    const host = parsed.hostname.replace(/^www\./, "");
    const known =
      STORE_HOSTS.has(parsed.hostname) ||
      STORE_HOSTS.has(host) ||
      parsed.hostname === wpHost;
    if (!known) return trimmed;
    return rewriteStorefrontPath(
      `${parsed.pathname}${parsed.search}${parsed.hash}`,
    );
  } catch {
    return trimmed;
  }
}

export function titleForSlug(slug: string) {
  return CONTENT_PAGES.find((page) => page.slug === slug)?.title ?? slug;
}

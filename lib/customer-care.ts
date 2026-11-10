import pagesJson from "@/data/customer-care/pages.json";

export type CareTableRow = { label: string; value: string };

export type CareBlock =
  | { type: "paragraph"; text: string }
  | { type: "caption"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "faq"; question: string; answer: string }
  | { type: "table"; headers: string[]; rows: CareTableRow[] }
  | { type: "contact"; fields: Array<{ label: string; value: string }> };

export type CareSection = {
  id: string;
  title: string;
  blocks: CareBlock[];
};

export type CarePage = {
  slug: string;
  title: string;
  effectiveDate: string;
  tagline: string;
  intro: string[];
  description: string;
  sections: CareSection[];
  /** Source lines in order, shown as written. */
  lines?: string[];
};

const PAGES = pagesJson.pages as CarePage[];

export function customerCarePages() {
  return PAGES;
}

export function customerCareBySlug(slug: string) {
  return PAGES.find((page) => page.slug === slug) ?? null;
}

export const CUSTOMER_CARE_SLUGS = PAGES.map((page) => page.slug);

export const CARE_LABEL_HREFS: Record<string, string> = {
  "Shop Products": "/products",
  "Shop Electronics": "/products",
  "Terms of Service": "/terms-of-service",
  "Privacy Policy": "/privacy-policy",
  "Return and Refund Policy": "/return-and-refund-policy",
  "Returns and Refunds": "/return-and-refund-policy",
  "Payment Policy": "/payment-policy",
  "Contact Us": "/contact-us",
  "Shipping Policy": "/shipping-policy",
  "Shipping Information": "/shipping-policy",
  "View Our Shipping Policy": "/shipping-policy",
  "Cancellation Policy": "/cancellation-policy",
  "Buy Now, Pay Later": "/buy-now-pay-later",
  "Buy Now, Pay Later Information": "/buy-now-pay-later",
  "Read Our BNPL Information": "/buy-now-pay-later",
  "Warranty Information": "/warranty",
  "View Warranty Information": "/warranty",
  "Track Your Order": "/track-your-order",
  "Frequently Asked Questions": "/faqs",
  "Cookie Policy": "/cookie-policy",
  "Legal Notice": "/legal-notice",
  "Accessibility Statement": "/accessibility-statement",
  "Your Privacy Choices": "/your-privacy-choices",
  "Read Our Shipping Policy": "/shipping-policy",
  "Explore Our Shipping Policy": "/shipping-policy",
  "View Shipping Policy": "/shipping-policy",
  "Explore Buy Now, Pay Later": "/buy-now-pay-later",
  "Explore BNPL Options": "/buy-now-pay-later",
  "Learn More About Buy Now, Pay Later": "/buy-now-pay-later",
  "Learn About Buy Now, Pay Later": "/buy-now-pay-later",
  "Read Our Return and Refund Policy": "/return-and-refund-policy",
  "View Return and Refund Policy": "/return-and-refund-policy",
  "Read Our Warranty Information": "/warranty",
  "Read Our Cancellation Policy": "/cancellation-policy",
  "Read Our Payment Policy": "/payment-policy",
  "Read Our Privacy Policy": "/privacy-policy",
  "Contact Our Team": "/contact-us",
  "Contact Customer Support": "/contact-us",
  "Share Your Feedback": "/contact-us",
  "Shop Orvexo Electronics": "/products",
  "Shop All": "/products",
  "About Us": "/about-us",
  "Our Commitment": "/our-commitment",
  "Shipping & Delivery Policy": "/shipping-policy",
  "Shipping & Delivery": "/shipping-policy",
  "Return & Refund Policy": "/return-and-refund-policy",
  "Returns & Refunds Policy": "/return-and-refund-policy",
  "Order Cancellation Policy": "/cancellation-policy",
  "Payment Methods": "/payment-policy",
  "Payment Methods & Payment Policy": "/payment-policy",
  "Warranty & Product Support": "/warranty",
  "Order Help Center": "/order-help-center",
};

export function hrefForAbsoluteUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "plorix.us" || host === "droviia.us" || host === "orvexo.us") {
      const path = parsed.pathname.replace(/\/$/, "") || "/";
      return path;
    }
  } catch {
    return url;
  }
  return url;
}

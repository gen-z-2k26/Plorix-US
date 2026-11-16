import { revalidatePath, revalidateTag, updateTag } from "next/cache";

/**
 * Home, shop, product, and collection pages. Paid orders and cart conflicts
 * refresh the affected products right away, so this window only bounds edits
 * made in WooCommerce admin.
 */
export const STOCK_REVALIDATE_SECONDS = 60 * 60;

/** About, policies, reviews, and other pages that do not show inventory. */
export const CONTENT_REVALIDATE_SECONDS = 60 * 60;

/** Public product feed. Shoppers do not request this on each page view. */
export const FEED_REVALIDATE_SECONDS = 15 * 60;

/** Chat widget payment list. Checkout reads payment settings on its own. */
export const PAYMENT_METHODS_REVALIDATE_SECONDS = 5 * 60;

export const CATALOG_TAG = "woo-catalog";

export function productTag(slug: string) {
  return `woo-product:${slug}`;
}

function expireTag(tag: string) {
  try {
    updateTag(tag);
  } catch {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Outside a request or action. The page still expires on its own.
    }
  }
}

function expirePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Path refresh only works inside a request.
  }
}

/**
 * Drops cached data and pages for the given products only. Every other
 * product page keeps its cached copy.
 */
export function refreshProducts(slugs: string[]) {
  for (const slug of new Set(slugs.filter(Boolean))) {
    expireTag(productTag(slug));
    expirePath(`/products/${slug}`);
  }
}

/**
 * Drops every cached catalog page. Expensive: each product and collection
 * page rebuilds on its next view. Reserve for changes that affect listings,
 * such as a product selling out.
 */
export function refreshCatalog() {
  expireTag(CATALOG_TAG);
  expirePath("/");
  expirePath("/products");
  expirePath("/products/[slug]", "page");
  expirePath("/collection/[slug]", "page");
}

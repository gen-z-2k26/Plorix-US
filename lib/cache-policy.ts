import { revalidatePath, revalidateTag, updateTag } from "next/cache";

/** Home, shop, product, and collection pages. Stock and price stay inside this window. */
export const STOCK_REVALIDATE_SECONDS = 5 * 60;

/** About, policies, reviews, and other pages that do not show inventory. */
export const CONTENT_REVALIDATE_SECONDS = 60 * 60;

/** Public product feed. Shoppers do not request this on each page view. */
export const FEED_REVALIDATE_SECONDS = 15 * 60;

/** Chat widget payment list. Checkout reads payment settings on its own. */
export const PAYMENT_METHODS_REVALIDATE_SECONDS = 5 * 60;

export const CATALOG_TAG = "woo-catalog";

/**
 * Drops cached catalog pages after WooCommerce disagrees with them, or after
 * an order is paid and stock has changed. The next view rebuilds once.
 */
export function refreshCatalog() {
  try {
    updateTag(CATALOG_TAG);
  } catch {
    try {
      revalidateTag(CATALOG_TAG, { expire: 0 });
    } catch {
      // This process already missed the tag. The stock pages still expire on their own.
    }
  }

  for (const path of ["/", "/products"]) {
    try {
      revalidatePath(path);
    } catch {
      // Path refresh only works inside a request.
    }
  }

  try {
    revalidatePath("/products/[slug]", "page");
  } catch {
    // Same as above.
  }

  try {
    revalidatePath("/collection/[slug]", "page");
  } catch {
    // Same as above.
  }
}

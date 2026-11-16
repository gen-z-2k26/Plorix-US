import { getWooOrigin, WOO_TIMEOUT_MS } from "@/lib/api/client";
import { mapStoreCart } from "@/lib/api/map-cart";
import type { RawStoreCart } from "@/lib/api/map-cart";
import {
  addStoreCartItem,
  applyStoreCoupon,
  clearStoreCart,
} from "@/lib/api/store-api";

function sessionCookies(response: Response) {
  const jar = new Map<string, string>();
  for (const line of response.headers.getSetCookie?.() ?? []) {
    const pair = line.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name || !value) continue;
    if (
      name.startsWith("wp_woocommerce_session_") ||
      name === "woocommerce_items_in_cart" ||
      name === "woocommerce_cart_hash"
    ) {
      jar.set(name, value);
    }
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

/**
 * The recovery email opens the storefront with the plugin token. WordPress
 * still owns the saved cart, so load that session and copy it into this shopper's cart.
 */
export async function restoreAbandonedCartFromToken(token: string) {
  const origin = getWooOrigin();
  const trimmed = token.trim();
  if (!origin || trimmed.length < 8 || trimmed.length > 2000) return;
  if (/[\r\n\s]/.test(trimmed)) return;

  const checkout = await fetch(
    `${origin}/checkout/?wcf_ac_token=${encodeURIComponent(trimmed)}`,
    {
      redirect: "manual",
      headers: { "User-Agent": "DroviaStorefront/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
    },
  );
  const cookie = sessionCookies(checkout);
  if (!cookie) return;

  const cartResponse = await fetch(`${origin}/wp-json/wc/store/v1/cart`, {
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      "User-Agent": "DroviaStorefront/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
  });
  if (!cartResponse.ok) return;
  const restored = mapStoreCart((await cartResponse.json()) as RawStoreCart);
  if (!restored.items.length) return;

  await clearStoreCart();
  for (const item of restored.items) {
    const id = Number(item.productId);
    if (!Number.isFinite(id) || id <= 0) continue;
    await addStoreCartItem({ id, quantity: Math.max(1, item.quantity) });
  }
  for (const coupon of restored.coupons) {
    try {
      await applyStoreCoupon(coupon.code);
    } catch {
      // The products are already in the cart if the coupon is no longer valid.
    }
  }
}

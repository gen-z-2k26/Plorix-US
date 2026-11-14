import { cookies } from "next/headers";
import { getWooOrigin, WOO_TIMEOUT_MS } from "@/lib/api/client";
import type { StoreCart } from "@/lib/types";

const JAR_COOKIE = "wcar_session_jar";
const JAR_MAX_AGE = 60 * 60 * 48;
export const ABANDONMENT_SESSION_META = "_storefront_wcar_session";

type Jar = Record<string, string>;

type MirrorItem = {
  key: string;
  id: number;
  quantity: number;
};

type MirrorCart = {
  items: MirrorItem[];
  coupons: string[];
};

let checkoutNonce: { nonce: string; postId: string; ajaxurl: string; at: number } | null = null;

function emailReady(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function readJar(): Promise<Jar> {
  try {
    const raw = (await cookies()).get(JAR_COOKIE)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Jar;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJar(jar: Jar) {
  const store = await cookies();
  const names = Object.keys(jar);
  if (!names.length) {
    if (store.get(JAR_COOKIE)) store.delete(JAR_COOKIE);
    return;
  }
  store.set(JAR_COOKIE, JSON.stringify(jar), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: JAR_MAX_AGE,
  });
}

function absorbCookies(jar: Jar, response: Response) {
  const list = response.headers.getSetCookie?.() ?? [];
  for (const line of list) {
    const pair = line.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (
      name.startsWith("wp_woocommerce_session_") ||
      name === "woocommerce_items_in_cart" ||
      name === "woocommerce_cart_hash"
    ) {
      if (!value || value === "deleted") delete jar[name];
      else jar[name] = value;
    }
  }
  return jar;
}

function cookieHeader(jar: Jar) {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function mirrorFetch(
  jar: Jar,
  path: string,
  init?: { method?: string; body?: unknown; nonce?: string },
) {
  const origin = getWooOrigin();
  if (!origin) throw new Error("WooCommerce is not configured.");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "DroviaStorefront/1.0",
  };
  const cookie = cookieHeader(jar);
  if (cookie) headers.Cookie = cookie;
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  if (init?.nonce) headers.Nonce = init.nonce;
  const response = await fetch(`${origin}/wp-json/wc/store/v1/${path}`, {
    method: init?.method || "GET",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
  });
  absorbCookies(jar, response);
  const nonce =
    response.headers.get("Nonce") ||
    response.headers.get("X-WC-Store-API-Nonce") ||
    "";
  const json = (await response.json().catch(() => null)) as {
    items?: Array<{ key?: string; id?: number; quantity?: number }>;
    coupons?: Array<{ code?: string }>;
    message?: string;
  } | null;
  if (!response.ok) {
    throw new Error(json?.message || "Could not update the recovery cart.");
  }
  return { json, nonce };
}

function mapMirror(json: { items?: Array<{ key?: string; id?: number; quantity?: number }>; coupons?: Array<{ code?: string }> } | null): MirrorCart {
  return {
    items: (json?.items ?? [])
      .map((item) => ({
        key: item.key || "",
        id: Number(item.id) || 0,
        quantity: Number(item.quantity) || 0,
      }))
      .filter((item) => item.key && item.id),
    coupons: (json?.coupons ?? []).map((coupon) => coupon.code || "").filter(Boolean),
  };
}

async function loadMirror(jar: Jar) {
  const loaded = await mirrorFetch(jar, "cart");
  return { cart: mapMirror(loaded.json), nonce: loaded.nonce };
}

async function alignMirror(jar: Jar, cart: StoreCart) {
  let { cart: mirror, nonce } = await loadMirror(jar);
  const wanted = new Map<number, number>();
  for (const item of cart.items) {
    const id = Number(item.productId);
    if (!Number.isFinite(id) || id <= 0) continue;
    wanted.set(id, (wanted.get(id) || 0) + item.quantity);
  }

  for (const item of mirror.items) {
    if (wanted.get(item.id) === item.quantity) continue;
    if (!wanted.has(item.id)) {
      const removed = await mirrorFetch(jar, "cart/remove-item", {
        method: "POST",
        body: { key: item.key },
        nonce,
      });
      nonce = removed.nonce || nonce;
      continue;
    }
  }

  ({ cart: mirror, nonce } = await loadMirror(jar));
  for (const item of mirror.items) {
    const quantity = wanted.get(item.id);
    if (!quantity || quantity === item.quantity) continue;
    const updated = await mirrorFetch(jar, "cart/update-item", {
      method: "POST",
      body: { key: item.key, quantity },
      nonce,
    });
    nonce = updated.nonce || nonce;
    wanted.delete(item.id);
  }

  ({ cart: mirror, nonce } = await loadMirror(jar));
  const present = new Set(mirror.items.map((item) => item.id));
  for (const [id, quantity] of wanted) {
    if (present.has(id)) continue;
    const added = await mirrorFetch(jar, "cart/add-item", {
      method: "POST",
      body: { id, quantity },
      nonce,
    });
    nonce = added.nonce || nonce;
  }

  ({ cart: mirror, nonce } = await loadMirror(jar));
  const wantedCoupons = new Set(cart.coupons.map((coupon) => coupon.code.toLowerCase()));
  for (const code of mirror.coupons) {
    if (wantedCoupons.has(code.toLowerCase())) continue;
    const removed = await mirrorFetch(jar, "cart/remove-coupon", {
      method: "POST",
      body: { code },
      nonce,
    });
    nonce = removed.nonce || nonce;
  }
  ({ cart: mirror, nonce } = await loadMirror(jar));
  const applied = new Set(mirror.coupons.map((code) => code.toLowerCase()));
  for (const coupon of cart.coupons) {
    if (applied.has(coupon.code.toLowerCase())) continue;
    try {
      const added = await mirrorFetch(jar, "cart/apply-coupon", {
        method: "POST",
        body: { code: coupon.code },
        nonce,
      });
      nonce = added.nonce || nonce;
    } catch {
      // A coupon the recovery cart rejects still leaves the product rows intact.
    }
  }
  return loadMirror(jar);
}

async function checkoutTracker(jar: Jar) {
  if (checkoutNonce && Date.now() - checkoutNonce.at < 10 * 60 * 1000) {
    return checkoutNonce;
  }
  const origin = getWooOrigin();
  if (!origin) throw new Error("WooCommerce is not configured.");
  const headers: Record<string, string> = { "User-Agent": "DroviaStorefront/1.0" };
  const cookie = cookieHeader(jar);
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${origin}/checkout/`, {
    headers,
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
  });
  absorbCookies(jar, response);
  const html = await response.text();
  const match = html.match(/wcf_ca_vars\s*=\s*(\{.*?\});/);
  if (!match) throw new Error("Cart abandonment tracking is not available on checkout.");
  const vars = JSON.parse(match[1]) as { _nonce?: string; _post_id?: string; ajaxurl?: string };
  if (!vars._nonce || !vars.ajaxurl) {
    throw new Error("Cart abandonment tracking is not available on checkout.");
  }
  checkoutNonce = {
    nonce: vars._nonce,
    postId: String(vars._post_id || ""),
    ajaxurl: vars.ajaxurl,
    at: Date.now(),
  };
  return checkoutNonce;
}

async function postCapture(jar: Jar, cart: StoreCart | null) {
  const tracker = await checkoutTracker(jar);
  const billing = cart?.billingAddress;
  const shipping = cart?.shippingAddress;
  const body = new URLSearchParams({
    action: "cartflows_save_cart_abandonment_data",
    security: tracker.nonce,
    wcf_email: billing?.email?.trim() || "",
    wcf_name: billing?.firstName || shipping?.firstName || "",
    wcf_surname: billing?.lastName || shipping?.lastName || "",
    wcf_phone: billing?.phone || shipping?.phone || "",
    wcf_country: billing?.country || shipping?.country || "",
    wcf_city: billing?.city || shipping?.city || "",
    wcf_billing_company: billing?.company || "",
    wcf_billing_address_1: billing?.address1 || "",
    wcf_billing_address_2: billing?.address2 || "",
    wcf_billing_state: billing?.state || "",
    wcf_billing_postcode: billing?.postcode || "",
    wcf_shipping_first_name: shipping?.firstName || "",
    wcf_shipping_last_name: shipping?.lastName || "",
    wcf_shipping_company: shipping?.company || "",
    wcf_shipping_country: shipping?.country || "",
    wcf_shipping_address_1: shipping?.address1 || "",
    wcf_shipping_address_2: shipping?.address2 || "",
    wcf_shipping_city: shipping?.city || "",
    wcf_shipping_state: shipping?.state || "",
    wcf_shipping_postcode: shipping?.postcode || "",
    wcf_order_comments: "",
    wcf_post_id: tracker.postId,
  });
  const ajaxurl = tracker.ajaxurl;
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "DroviaStorefront/1.0",
  };
  const cookie = cookieHeader(jar);
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(ajaxurl, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
  });
  absorbCookies(jar, response);
  if (!response.ok) throw new Error("Cart abandonment capture failed.");
}

async function emptyMirror(jar: Jar) {
  let { cart, nonce } = await loadMirror(jar);
  if (!cart.items.length && !cart.coupons.length) return;
  if (cart.items.length) await checkoutTracker(jar);
  for (const item of cart.items) {
    const removed = await mirrorFetch(jar, "cart/remove-item", {
      method: "POST",
      body: { key: item.key },
      nonce,
    });
    nonce = removed.nonce || nonce;
  }
  ({ cart, nonce } = await loadMirror(jar));
  for (const code of cart.coupons) {
    const removed = await mirrorFetch(jar, "cart/remove-coupon", {
      method: "POST",
      body: { code },
      nonce,
    });
    nonce = removed.nonce || nonce;
  }
  await postCapture(jar, null);
}

/**
 * Sends the live cart and checkout fields into WooCommerce Cart Abandonment
 * Recovery. The plugin reads products from the WordPress cart session and
 * the customer fields from this request, then fills the email template.
 * Returns the session jar to store on the Woo order.
 */
export async function noteCartForAbandonment(cart: StoreCart): Promise<string | null> {
  const origin = getWooOrigin();
  if (!origin) return null;
  const jar = await readJar();
  const email = cart.billingAddress.email || cart.shippingAddress.email || "";
  try {
    if (!emailReady(email) || !cart.items.length) return null;
    await alignMirror(jar, cart);
    await postCapture(jar, cart);
    await writeJar(jar);
    return JSON.stringify(jar);
  } catch (error) {
    console.warn("[storefront] cart abandonment capture failed:", error);
    return Object.keys(jar).length ? JSON.stringify(jar) : null;
  }
}

/** Drops the recovery row after the order is paid so the reminder is not sent. */
export async function releaseAbandonedCart(serialized: string | null | undefined) {
  if (!serialized || !getWooOrigin()) return;
  let jar: Jar;
  try {
    jar = JSON.parse(serialized) as Jar;
  } catch {
    return;
  }
  if (!jar || typeof jar !== "object") return;
  try {
    await emptyMirror(jar);
  } catch (error) {
    console.warn("[storefront] cart abandonment release failed:", error);
  }
}

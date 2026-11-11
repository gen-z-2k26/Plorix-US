import { cookies } from "next/headers";
import {
  getWooOrigin,
  isWooConfigured,
  isWooUnreachable,
  markWooReachable,
  isHardWooOutage,
  markWooUnreachable,
  WOO_TIMEOUT_MS,
} from "@/lib/api/client";
import { WooCommerceApiError } from "@/lib/api/errors";
import {
  emptyStoreCart,
  mapGuestOrder,
  mapStoreCart,
  toWooAddress,
  type RawStoreCart,
} from "@/lib/api/map-cart";
import { isStoreNonceError, storeRequestHeaders } from "@/lib/api/store-headers";
import { HAS_CART_COOKIE } from "@/lib/cart-presence";
import type { Address, GuestOrder, StoreCart } from "@/lib/types";

const CART_COOKIE = "wc_cart_token";
const NONCE_COOKIE = "wc_store_nonce";
const PENDING_COOKIE = "wc_pending_order";
const TOKEN_MAX_AGE = 60 * 60 * 48;

export type PendingCheckout = {
  orderId: string;
  orderKey: string;
  paymentIntentId: string;
  cartHash: string;
};

type StoreRequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
  nonce?: string;
};

function headerValue(headers: Headers, name: string) {
  return headers.get(name) || headers.get(name.toLowerCase());
}

async function storeRequest<T>(
  path: string,
  options: StoreRequestOptions = {},
): Promise<{ data: T; token: string | null; nonce: string | null }> {
  const origin = getWooOrigin();
  if (!origin) {
    throw new WooCommerceApiError("WooCommerce is not configured.", {
      code: "missing_env",
    });
  }
  if (isWooUnreachable()) {
    throw new WooCommerceApiError(
      "The store server is unreachable right now. Please try again shortly.",
      { code: "ECONNABORTED" },
    );
  }

  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  const nonce = options.nonce || store.get(NONCE_COOKIE)?.value;
  const headers = storeRequestHeaders({
    method: options.method,
    token,
    nonce,
  });

  const url = new URL(`${origin}/wp-json/wc/store/v1/${path.replace(/^\//, "")}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;
    if (isHardWooOutage(code)) markWooUnreachable();
    throw new WooCommerceApiError(
      "The store server is unreachable right now. Please try again shortly.",
      { code: "ECONNABORTED", endpoint: url.pathname },
    );
  }
  markWooReachable();

  const nextToken = headerValue(response.headers, "Cart-Token");
  const nextNonce =
    headerValue(response.headers, "Nonce") ||
    headerValue(response.headers, "X-WC-Store-API-Nonce");
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  };
  if (nextToken) store.set(CART_COOKIE, nextToken, cookieOptions);
  if (nextNonce) store.set(NONCE_COOKIE, nextNonce, cookieOptions);

  const contentType = response.headers.get("content-type") || "";
  if (!/application\/json|application\/.*\+json/i.test(contentType)) {
    throw new WooCommerceApiError(
      "The store cart did not return JSON. Check that the WooCommerce Store API is reachable.",
      { status: response.status, code: "invalid_content_type", endpoint: url.pathname },
    );
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const body = json as {
      message?: string;
      code?: string;
      data?: { cart?: RawStoreCart; details?: Record<string, { message?: string }> };
    } | null;
    const details = [
      ...new Set(
        Object.values(body?.data?.details ?? {})
          .map((detail) => detail?.message?.trim())
          .filter(Boolean),
      ),
    ];
    throw new WooCommerceApiError(
      details.length ? details.join(" ") : body?.message || "The cart could not be updated.",
      {
        status: response.status,
        code: body?.code,
        endpoint: url.pathname,
      },
    );
  }

  return { data: json as T, token: nextToken, nonce: nextNonce };
}

async function syncCartPresence(itemCount: number) {
  try {
    const store = await cookies();
    if (itemCount > 0) {
      store.set(HAS_CART_COOKIE, "1", {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: TOKEN_MAX_AGE,
      });
      return;
    }
    if (store.get(HAS_CART_COOKIE)) store.delete(HAS_CART_COOKIE);
  } catch {
    // The cart token still works if this hint cannot be written.
  }
}

async function cartCall(
  path: string,
  options: StoreRequestOptions = {},
): Promise<StoreCart> {
  if (!isWooConfigured()) return emptyStoreCart();
  const { data } = await storeRequest<RawStoreCart>(path, options);
  const cart = mapStoreCart(data);
  await syncCartPresence(cart.items.length);
  return cart;
}

async function mutateCart(
  path: string,
  options: StoreRequestOptions,
): Promise<StoreCart> {
  let nonce = options.nonce || (await currentStoreNonce());
  if (!nonce) {
    const session = await storeRequest<RawStoreCart>("cart");
    nonce = session.nonce || "";
  }
  try {
    return await cartCall(path, { ...options, nonce });
  } catch (error) {
    if (!(error instanceof WooCommerceApiError) || !isStoreNonceError(error.code)) {
      throw error;
    }
    const session = await storeRequest<RawStoreCart>("cart");
    return cartCall(path, { ...options, nonce: session.nonce || "" });
  }
}

export async function getStoreCart(): Promise<StoreCart> {
  return cartCall("cart");
}

async function currentStoreNonce() {
  const store = await cookies();
  return store.get(NONCE_COOKIE)?.value || "";
}

export async function addStoreCartItem(input: {
  id: number;
  quantity: number;
}): Promise<StoreCart> {
  return mutateCart("cart/add-item", {
    method: "POST",
    body: { id: input.id, quantity: input.quantity },
  });
}

export async function updateStoreCartItem(input: {
  key: string;
  quantity: number;
}): Promise<StoreCart> {
  return mutateCart("cart/update-item", {
    method: "POST",
    body: { key: input.key, quantity: input.quantity },
  });
}

export async function removeStoreCartItem(key: string): Promise<StoreCart> {
  return mutateCart("cart/remove-item", {
    method: "POST",
    body: { key },
  });
}

export async function applyStoreCoupon(code: string): Promise<StoreCart> {
  return mutateCart("cart/apply-coupon", {
    method: "POST",
    body: { code },
  });
}

export async function removeStoreCoupon(code: string): Promise<StoreCart> {
  return mutateCart("cart/remove-coupon", {
    method: "POST",
    body: { code },
  });
}

export async function updateStoreCustomer(input: {
  shipping: Address;
  billing: Address;
}): Promise<StoreCart> {
  return mutateCart("cart/update-customer", {
    method: "POST",
    body: {
      shipping_address: toWooAddress(input.shipping, false),
      billing_address: toWooAddress(input.billing, true),
    },
  });
}

export async function selectStoreShippingRate(input: {
  packageId: number;
  rateId: string;
}): Promise<StoreCart> {
  return mutateCart("cart/select-shipping-rate", {
    method: "POST",
    body: { package_id: input.packageId, rate_id: input.rateId },
  });
}

export async function clearStoreCart(): Promise<StoreCart> {
  return mutateCart("cart/items", { method: "DELETE" });
}

export async function getGuestStoreOrder(input: {
  orderId: string;
  orderKey: string;
  email: string;
}): Promise<GuestOrder> {
  const { data } = await storeRequest<RawStoreCart & {
    id?: number | string;
    order_key?: string;
    status?: string;
    date_created?: string;
  }>(`order/${encodeURIComponent(input.orderId)}`, {
    query: {
      key: input.orderKey,
      billing_email: input.email,
    },
  });
  return mapGuestOrder(data, input.orderKey);
}

export async function getPendingCheckout(): Promise<PendingCheckout | null> {
  const store = await cookies();
  const raw = store.get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCheckout;
    if (!parsed.orderId || !parsed.cartHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setPendingCheckout(value: PendingCheckout | null) {
  const store = await cookies();
  if (!value) {
    store.delete(PENDING_COOKIE);
    return;
  }
  store.set(PENDING_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  });
}

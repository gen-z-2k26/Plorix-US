"use server";

import { isWooConfigured } from "@/lib/api/client";
import { emptyStoreCart } from "@/lib/api/map-cart";
import {
  addStoreCartItem,
  applyStoreCoupon,
  clearStoreCart,
  getStoreCart,
  removeStoreCartItem,
  removeStoreCoupon,
  selectStoreShippingRate,
  updateStoreCartItem,
  updateStoreCustomer,
} from "@/lib/api/store-api";
import { isCatalogConflict } from "@/lib/catalog-conflict";
import { refreshCatalog } from "@/lib/cache-policy";
import { cartErrorMessage, type CartMutation } from "@/lib/cart-result";
import type { Address, StoreCart } from "@/lib/types";

function failedCart(error: unknown, fallback: string): CartMutation {
  if (isCatalogConflict(error)) {
    refreshCatalog();
    return {
      ok: false,
      message: cartErrorMessage(error, fallback),
      catalogStale: true,
    };
  }
  return { ok: false, message: cartErrorMessage(error, fallback) };
}

export async function getCartAction(): Promise<StoreCart> {
  if (!isWooConfigured()) return emptyStoreCart();
  try {
    return await getStoreCart();
  } catch {
    return emptyStoreCart();
  }
}

export async function addItemToCartAction(input: {
  id: number;
  quantity?: number;
}): Promise<CartMutation> {
  const quantity = Math.max(1, Number(input.quantity) || 1);
  try {
    return { ok: true, cart: await addStoreCartItem({ id: input.id, quantity }) };
  } catch (error) {
    return failedCart(error, "Could not add that product to the cart.");
  }
}

export async function shopNowAction(input: {
  id: number;
  quantity?: number;
  emptyCart?: boolean;
}): Promise<CartMutation> {
  const quantity = Math.max(1, Number(input.quantity) || 1);
  try {
    if (input.emptyCart) {
      await clearStoreCart();
    } else {
      // Repeat Buy Now clicks set the line to the chosen quantity instead of stacking it.
      const existing = (await getStoreCart()).items.find(
        (item) => item.productId === String(input.id),
      );
      if (existing) {
        const cart =
          existing.quantity === quantity
            ? await getStoreCart()
            : await updateStoreCartItem({ key: existing.key, quantity });
        return { ok: true, cart };
      }
    }
    return { ok: true, cart: await addStoreCartItem({ id: input.id, quantity }) };
  } catch (error) {
    return failedCart(error, "Could not start checkout.");
  }
}

export async function updateCartItemAction(input: {
  key: string;
  quantity: number;
}): Promise<CartMutation> {
  try {
    const cart =
      input.quantity <= 0
        ? await removeStoreCartItem(input.key)
        : await updateStoreCartItem(input);
    return { ok: true, cart };
  } catch (error) {
    return failedCart(error, "Could not update quantity.");
  }
}

export async function removeCartItemAction(key: string): Promise<CartMutation> {
  try {
    return { ok: true, cart: await removeStoreCartItem(key) };
  } catch (error) {
    return failedCart(error, "Could not remove that item.");
  }
}

export async function applyCouponAction(code: string): Promise<CartMutation> {
  try {
    return { ok: true, cart: await applyStoreCoupon(code.trim()) };
  } catch (error) {
    return failedCart(error, "Coupon could not be applied.");
  }
}

export async function removeCouponAction(code: string): Promise<CartMutation> {
  try {
    return { ok: true, cart: await removeStoreCoupon(code) };
  } catch (error) {
    return failedCart(error, "Coupon could not be removed.");
  }
}

export async function updateCustomerAction(input: {
  shipping: Address;
  billing: Address;
}): Promise<CartMutation> {
  try {
    return { ok: true, cart: await updateStoreCustomer(input) };
  } catch (error) {
    return failedCart(error, "Could not update the delivery details.");
  }
}

export async function selectShippingRateAction(input: {
  packageId: number;
  rateId: string;
}): Promise<CartMutation> {
  try {
    return { ok: true, cart: await selectStoreShippingRate(input) };
  } catch (error) {
    return failedCart(error, "Could not select shipping.");
  }
}

export async function migrateLegacyCartAction(
  items: Array<{ productId: string; quantity: number }>,
): Promise<StoreCart> {
  if (!isWooConfigured() || !items.length) {
    return getCartAction();
  }
  try {
    let cart = await getStoreCart();
    if (cart.items.length) return cart;
    for (const item of items) {
      const id = Number(item.productId);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (!Number.isFinite(id) || id <= 0) continue;
      cart = await addStoreCartItem({ id, quantity });
    }
    return cart;
  } catch {
    return emptyStoreCart();
  }
}

export async function emptyCartAction(): Promise<StoreCart> {
  try {
    return await clearStoreCart();
  } catch {
    return emptyStoreCart();
  }
}

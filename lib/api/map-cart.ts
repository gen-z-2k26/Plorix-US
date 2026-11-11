import { plainStoreMessage } from "@/lib/cart-result";
import { wooAddressFields } from "@/lib/checkout-address";
import { fromStoreAmount } from "@/lib/money";
import type {
  Address,
  AppliedCoupon,
  CartTaxLine,
  CartTotals,
  GuestOrder,
  ShippingRate,
  StoreCart,
  StoreCartItem,
} from "@/lib/types";

type MoneyBlock = {
  currency_code?: string;
  currency_minor_unit?: number;
  total_items?: string;
  total_price?: string;
  total_discount?: string;
  total_shipping?: string;
  total_tax?: string;
  subtotal?: string;
};

type RawAddress = {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
};

export type RawStoreCart = {
  items?: Array<{
    key?: string;
    id?: number;
    quantity?: number;
    name?: string;
    permalink?: string;
    quantity_limits?: { minimum?: number; maximum?: number };
    images?: Array<{ src?: string }>;
    prices?: {
      price?: string;
      regular_price?: string;
      currency_minor_unit?: number;
    };
  }>;
  coupons?: Array<{
    code?: string;
    discount_type?: string;
    totals?: { total_discount?: string; currency_minor_unit?: number };
  }>;
  tax_lines?: Array<{ name?: string; price?: string }>;
  totals?: MoneyBlock;
  shipping_address?: RawAddress;
  billing_address?: RawAddress;
  needs_shipping?: boolean;
  needs_payment?: boolean;
  has_calculated_shipping?: boolean;
  shipping_rates?: Array<{
    package_id?: number;
    shipping_rates?: Array<{
      rate_id?: string;
      method_id?: string;
      name?: string;
      price?: string;
      selected?: boolean;
      currency_minor_unit?: number;
    }>;
  }>;
  errors?: Array<{ message?: string } | string>;
  items_count?: number;
};

function slugFromPermalink(permalink?: string) {
  if (!permalink) return "";
  try {
    const path = new URL(permalink).pathname.replace(/\/$/, "");
    return path.split("/").filter(Boolean).pop() || "";
  } catch {
    return permalink.split("/").filter(Boolean).pop() || "";
  }
}

export function emptyAddress(): Address {
  return {
    firstName: "",
    lastName: "",
    company: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
    email: "",
    phone: "",
  };
}

export function mapAddress(raw?: RawAddress): Address {
  return {
    firstName: raw?.first_name || "",
    lastName: raw?.last_name || "",
    company: raw?.company || "",
    address1: raw?.address_1 || "",
    address2: raw?.address_2 || "",
    city: raw?.city || "",
    state: raw?.state || "",
    postcode: raw?.postcode || "",
    country: raw?.country || "",
    email: raw?.email || "",
    phone: raw?.phone || "",
  };
}

export function toWooAddress(address: Address, includeEmail: boolean) {
  const region = wooAddressFields(address);
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    company: address.company,
    address_1: address.address1,
    address_2: address.address2,
    city: address.city,
    state: region.state,
    postcode: region.postcode,
    country: region.country,
    phone: address.phone,
    ...(includeEmail ? { email: address.email } : {}),
  };
}

function mapTotals(raw?: MoneyBlock): CartTotals {
  const minor = raw?.currency_minor_unit ?? 2;
  return {
    subtotal: fromStoreAmount(raw?.total_items ?? raw?.subtotal, minor),
    discount: fromStoreAmount(raw?.total_discount, minor),
    shipping: fromStoreAmount(raw?.total_shipping, minor),
    tax: fromStoreAmount(raw?.total_tax, minor),
    total: fromStoreAmount(raw?.total_price, minor),
    currency: raw?.currency_code || "EUR",
    minorUnit: minor,
    totalMinor: String(raw?.total_price ?? "0"),
  };
}

function mapItems(raw: RawStoreCart): StoreCartItem[] {
  return (raw.items ?? []).map((item) => {
    const minor = item.prices?.currency_minor_unit ?? 2;
    return {
      key: String(item.key || ""),
      productId: String(item.id ?? ""),
      slug: slugFromPermalink(item.permalink),
      name: plainStoreMessage(item.name || "") || "Item",
      price: fromStoreAmount(item.prices?.price, minor),
      regularPrice: fromStoreAmount(
        item.prices?.regular_price || item.prices?.price,
        minor,
      ),
      image: item.images?.[0]?.src || "",
      quantity: Number(item.quantity) || 1,
      quantityMin: Number(item.quantity_limits?.minimum) || 1,
      quantityMax: Number(item.quantity_limits?.maximum) || 99,
    };
  });
}

function mapCoupons(raw: RawStoreCart): AppliedCoupon[] {
  return (raw.coupons ?? []).map((coupon) => {
    const minor = coupon.totals?.currency_minor_unit ?? raw.totals?.currency_minor_unit ?? 2;
    return {
      code: coupon.code || "",
      discount: fromStoreAmount(coupon.totals?.total_discount, minor),
      discountType: coupon.discount_type || "",
    };
  }).filter((coupon) => coupon.code);
}

function mapTaxLines(raw: RawStoreCart): CartTaxLine[] {
  const minor = raw.totals?.currency_minor_unit ?? 2;
  return (raw.tax_lines ?? [])
    .map((line) => ({
      name: line.name || "Tax",
      amount: fromStoreAmount(line.price, minor),
    }))
    .filter((line) => line.amount > 0 || line.name);
}

function mapRates(raw: RawStoreCart): ShippingRate[] {
  const rates: ShippingRate[] = [];
  for (const pack of raw.shipping_rates ?? []) {
    const packageId = Number(pack.package_id) || 0;
    for (const rate of pack.shipping_rates ?? []) {
      const minor = rate.currency_minor_unit ?? raw.totals?.currency_minor_unit ?? 2;
      rates.push({
        packageId,
        rateId: rate.rate_id || "",
        methodId: rate.method_id || "",
        name: plainStoreMessage(rate.name || "") || "Shipping",
        price: fromStoreAmount(rate.price, minor),
        selected: Boolean(rate.selected),
      });
    }
  }
  return rates;
}

export function cartHashFromParts(cart: Omit<StoreCart, "cartHash">): string {
  const items = cart.items
    .map((item) => `${item.key}:${item.quantity}`)
    .sort()
    .join("|");
  const coupons = cart.coupons.map((coupon) => coupon.code).sort().join(",");
  const ship = cart.shippingRates
    .filter((rate) => rate.selected)
    .map((rate) => rate.rateId)
    .join(",");
  const loc = [
    cart.shippingAddress.country,
    cart.shippingAddress.postcode,
    cart.shippingAddress.city,
    cart.billingAddress.email,
  ].join("|");
  return `${items}#${coupons}#${ship}#${loc}#${cart.totals.totalMinor}`;
}

export function emptyStoreCart(): StoreCart {
  const base = {
    items: [],
    coupons: [],
    taxLines: [],
    totals: {
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      currency: "EUR",
      minorUnit: 2,
      totalMinor: "0",
    },
    shippingAddress: emptyAddress(),
    billingAddress: emptyAddress(),
    needsShipping: false,
    needsPayment: false,
    hasCalculatedShipping: false,
    shippingRates: [],
    errors: [],
    itemsCount: 0,
  };
  return { ...base, cartHash: cartHashFromParts(base) };
}

export function mapStoreCart(raw: RawStoreCart | null | undefined): StoreCart {
  if (!raw) return emptyStoreCart();
  const errors = (raw.errors ?? []).map((entry) =>
    typeof entry === "string" ? entry : entry.message || "",
  ).filter(Boolean);
  const base = {
    items: mapItems(raw),
    coupons: mapCoupons(raw),
    taxLines: mapTaxLines(raw),
    totals: mapTotals(raw.totals),
    shippingAddress: mapAddress(raw.shipping_address),
    billingAddress: mapAddress(raw.billing_address),
    needsShipping: Boolean(raw.needs_shipping),
    needsPayment: Boolean(raw.needs_payment),
    hasCalculatedShipping: Boolean(raw.has_calculated_shipping),
    shippingRates: mapRates(raw),
    errors,
    itemsCount: Number(raw.items_count) || mapItems(raw).reduce((sum, item) => sum + item.quantity, 0),
  };
  return { ...base, cartHash: cartHashFromParts(base) };
}

export function mapGuestOrder(
  raw: RawStoreCart & {
    id?: number | string;
    order_key?: string;
    status?: string;
    date_created?: string;
  },
  orderKey: string,
): GuestOrder {
  const cart = mapStoreCart(raw);
  const billing = cart.billingAddress;
  return {
    orderId: String(raw.id ?? ""),
    orderKey: String(raw.order_key || orderKey),
    status:
      typeof raw.status === "string"
        ? raw.status
        : raw.status
          ? String(raw.status)
          : "",
    paid: raw.status === "processing" || raw.status === "completed",
    email: billing.email,
    name: [billing.firstName, billing.lastName].filter(Boolean).join(" ").trim(),
    totals: cart.totals,
    items: cart.items,
    shippingAddress: cart.shippingAddress,
    billingAddress: billing,
    coupons: cart.coupons,
    createdAt: raw.date_created || "",
  };
}

import { unstable_cache } from "next/cache";
import { cache } from "react";
import site from "@/data/site.json";
import pageContent from "@/data/pages.json";
import { CATALOG_TAG, CONTENT_REVALIDATE_SECONDS, STOCK_REVALIDATE_SECONDS } from "@/lib/cache-policy";
import { isCatalogSlug } from "@/lib/catalog-slug";
import { normalizeCountryCode } from "@/lib/checkout-address";
import {
  getWooOrigin,
  isWooConfigured,
  isWooUnreachable,
  isHardWooOutage,
  markWooUnreachable,
  wooGet,
  wooGetWithHeaders,
  WOO_TIMEOUT_MS,
} from "@/lib/api/client";
import { softWooCall, withWooErrorHandling } from "@/lib/api/errors";
import {
  mapWooCategory,
  mapWooProduct,
  type WooProduct,
} from "@/lib/api/map-product";
import {
  mergeWooStoreIdentity,
  type WooStoreMoney,
} from "@/lib/api/map-woo-store";
import { getLivePromo } from "@/lib/api/promo";
import { googleFontStylesheetUrl } from "@/lib/fonts";
import { getPaymentAccounts } from "@/lib/payment-config";
import type {
  Category,
  CountryOption,
  PaymentIconSlug,
  PaymentMethodIcon,
  ProductPaymentDisplay,
  Product,
  ProductReview,
  ProductReviewsPage,
  ReviewCatalogStats,
  StoreSettings,
} from "@/lib/types";
import { defaultPages, defaultProductPage } from "@/lib/types";

export {
  cancelUnpaidOrder,
  createPendingOrderFromCart,
  failUnpaidOrder,
  findUnpaidOrderByMeta,
  getOrder,
  markOrderPaid,
  mapWooOrder,
  setOrderCustomerNote,
  setOrderMeta,
  type WooOrder,
} from "@/lib/api/orders";
export { getEnabledCheckoutMethods } from "@/lib/api/payments";

const designSettings: StoreSettings = {
  ...(site as StoreSettings),
  productPage: {
    ...defaultProductPage,
    ...(site as StoreSettings).productPage,
    stripeCardBrands:
      (site as StoreSettings).productPage?.stripeCardBrands?.length
        ? (site as StoreSettings).productPage.stripeCardBrands
        : defaultProductPage.stripeCardBrands,
  },
  pages: {
    about: {
      ...defaultPages.about,
      ...pageContent.about,
      values: pageContent.about.values?.length
        ? pageContent.about.values
        : defaultPages.about.values,
      sections: pageContent.about.sections || [],
    },
    faq: {
      ...defaultPages.faq,
      ...pageContent.faq,
      groups: pageContent.faq.groups?.length
        ? pageContent.faq.groups
        : defaultPages.faq.groups,
    },
    contact: {
      ...defaultPages.contact,
      ...pageContent.contact,
    },
    commitment: {
      ...defaultPages.commitment,
      ...pageContent.commitment,
      sections: pageContent.commitment.sections || [],
    },
  },
  theme: {
    ...(site as StoreSettings).theme,
    fontUrl: googleFontStylesheetUrl([
      (site as StoreSettings).theme.font,
      (site as StoreSettings).theme.fontDisplay,
    ]),
  },
};
const CACHE_TTL_MS = STOCK_REVALIDATE_SECONDS * 1000;

const PRODUCT_FIELDS = [
  "id",
  "name",
  "slug",
  "price",
  "regular_price",
  "sale_price",
  "on_sale",
  "featured",
  "average_rating",
  "rating_count",
  "menu_order",
  "description",
  "short_description",
  "images",
  "categories",
  "tags",
  "sku",
  "related_ids",
  "stock_status",
  "stock_quantity",
  "manage_stock",
  "backorders",
].join(",");

const CARD_FIELDS = [
  "id",
  "name",
  "slug",
  "price",
  "regular_price",
  "sale_price",
  "on_sale",
  "featured",
  "average_rating",
  "rating_count",
  "menu_order",
  "images",
  "categories",
  "sku",
  "stock_status",
  "stock_quantity",
  "manage_stock",
  "backorders",
].join(",");

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

async function cachedSoftWooCall<T>(
  key: string,
  action: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const value = await withWooErrorHandling(action);
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return value;
    } catch (error) {
      if (cached) {
        return cached.value;
      }
      return softWooCall(
        async () => {
          throw error;
        },
        fallback,
        label,
      );
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

async function fetchWpSiteInfo(): Promise<{
  name?: string;
  description?: string;
  url?: string;
} | null> {
  if (!process.env.WC_URL) return null;
  try {
    const wpOrigin = process.env.WC_URL.replace(/\/$/, "").replace(
      /^http:\/\//i,
      "https://",
    );
    const response = await fetch(`${wpOrigin}/wp-json`, {
      next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: ["wp-site"] },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as {
      name?: string;
      description?: string;
      url?: string;
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;
    if (isHardWooOutage(code)) markWooUnreachable();
    return null;
  }
}

async function fetchStoreMoney(): Promise<WooStoreMoney | null> {
  const origin = getWooOrigin();
  if (!origin) return null;
  try {
    const response = await fetch(`${origin}/wp-json/wc/store/v1/cart`, {
      next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: ["woo-money"] },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(WOO_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { totals?: WooStoreMoney };
    return data.totals ?? null;
  } catch (error) {
    const code =
      error && typeof error === "object" && "cause" in error
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;
    if (isHardWooOutage(code)) markWooUnreachable();
    return null;
  }
}

type WooParams = Record<string, string | number | boolean>;

const readSettingsGroup = unstable_cache(
  async (group: string) =>
    wooGet<Array<{ id?: string; value?: string }>>(`settings/${group}`),
  ["woo-settings-group"],
  { revalidate: CONTENT_REVALIDATE_SECONDS },
);

const readProducts = unstable_cache(
  async (paramsKey: string) => {
    const params = JSON.parse(paramsKey) as WooParams;
    const data = await wooGet<WooProduct[]>("products", params);
    return data.map(mapWooProduct);
  },
  ["woo-products"],
  { revalidate: STOCK_REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
);

const readProductBySlug = unstable_cache(
  async (slug: string) => {
    const data = await wooGet<WooProduct[]>("products", {
      slug,
      _fields: PRODUCT_FIELDS,
    });
    const [product] = data;
    return product ? mapWooProduct(product) : null;
  },
  ["woo-product-by-slug"],
  { revalidate: STOCK_REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
);

const readCategories = unstable_cache(
  async () => {
    const data = await wooGet<Parameters<typeof mapWooCategory>[0][]>(
      "products/categories",
      {
        per_page: 100,
        hide_empty: true,
        orderby: "count",
        order: "desc",
      },
    );
    return data.map(mapWooCategory);
  },
  ["woo-categories"],
  { revalidate: STOCK_REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
);

async function readCatalog<T>(
  label: string,
  fallback: T,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    return softWooCall(async () => {
      throw error;
    }, fallback, label);
  }
}

const getProductsOnce = cache((paramsKey: string) =>
  readCatalog("getProducts", [] as Product[], () => readProducts(paramsKey)),
);

const getProductOnce = cache((slug: string) =>
  readCatalog(
    `getProduct(${slug})`,
    null as Product | null,
    () => readProductBySlug(slug),
  ),
);

/**
 * Design tokens and UI chrome come from Next (data/site.json).
 * Currency, symbol, and catalog identity overlay from WooCommerce.
 */
export const getSiteSettings = cache(async function getSiteSettings(): Promise<StoreSettings> {
  if (!isWooConfigured() || isWooUnreachable()) {
    return designSettings;
  }

  try {
    const [siteInfo, general, emailSettings, storeMoney] = await Promise.all([
      fetchWpSiteInfo(),
      cachedSoftWooCall(
        "settings/general",
        () => readSettingsGroup("general"),
        [],
        "settings/general",
      ),
      cachedSoftWooCall(
        "settings/email",
        () => readSettingsGroup("email"),
        [],
        "settings/email",
      ),
      fetchStoreMoney(),
    ]);

    const merged = mergeWooStoreIdentity(designSettings, {
      generalSettings: general,
      emailSettings,
      siteInfo,
      storeMoney,
    });
    const promo = isWooUnreachable()
      ? { promoBanner: "", promoCoupon: "", promoId: "" }
      : await cachedSoftWooCall(
          "promo:live",
          () => getLivePromo(merged),
          { promoBanner: "", promoCoupon: "", promoId: "" },
          "getLivePromo",
        );

    return {
      ...merged,
      promoBanner: promo.promoBanner,
      promoId: promo.promoId,
      promoCoupon: promo.promoCoupon,
    };
  } catch (error) {
    console.warn("[storefront] store identity fetch failed:", error);
    return designSettings;
  }
});

/** @deprecated Use getSiteSettings. */
export async function getStoreSettings(): Promise<StoreSettings> {
  return getSiteSettings();
}

export async function getProducts(options?: {
  featured?: boolean;
  include?: number[];
  category?: number;
  onSale?: boolean;
  perPage?: number;
  page?: number;
  card?: boolean;
}): Promise<Product[]> {
  if (!isWooConfigured() || isWooUnreachable()) {
    return [];
  }

  const params: WooParams = {
    per_page: options?.perPage ?? 100,
    page: options?.page ?? 1,
    status: "publish",
    orderby: "menu_order",
    order: "asc",
    _fields: options?.card ? CARD_FIELDS : PRODUCT_FIELDS,
  };

  if (options?.featured) params.featured = true;
  if (options?.onSale) params.on_sale = true;
  if (options?.category) params.category = options.category;
  if (options?.include?.length) {
    params.include = options.include.join(",");
    params.orderby = "include";
    params.per_page = options.include.length;
  }

  return getProductsOnce(JSON.stringify(params));
}

export async function getProductsByIds(ids: number[]): Promise<Product[]> {
  if (!ids.length) return [];
  return getProducts({ include: ids, perPage: ids.length, card: true });
}

/** Featured products as marked in WooCommerce admin. Falls back to latest products. */
export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const all = await getProducts({ perPage: 100, card: true });
  const featured = all.filter((product) => product.featured);
  if (featured.length >= limit) return featured.slice(0, limit);

  const seen = new Set(featured.map((product) => product.id));
  for (const product of all) {
    if (seen.has(product.id)) continue;
    featured.push(product);
    if (featured.length >= limit) break;
  }
  return featured.slice(0, limit);
}

export async function getOnSaleProducts(limit = 8): Promise<Product[]> {
  const all = await getProducts({ perPage: 100 });
  return all.filter((product) => product.onSale).slice(0, limit);
}

export async function getProductsByCategory(
  category: string,
): Promise<Product[]> {
  const [categories, allProducts] = await Promise.all([
    getCategoryRecords(),
    getProducts({ perPage: 100, card: true }),
  ]);
  const target = category.toLowerCase();
  const match = categories.find(
    (entry) =>
      entry.slug.toLowerCase() === target ||
      entry.name.toLowerCase() === target,
  );
  if (match) {
    const filtered = allProducts.filter((product) =>
      product.categories.some(
        (cat) =>
          cat.id === match.id ||
          cat.slug.toLowerCase() === match.slug.toLowerCase() ||
          cat.name.toLowerCase() === match.name.toLowerCase(),
      ),
    );
    if (filtered.length > 0) {
      return filtered;
    }
    return getProducts({ category: match.id, perPage: 100, card: true });
  }
  return [];
}

export const getCategoryRecords = cache(async function getCategoryRecords(): Promise<Category[]> {
  if (!isWooConfigured()) {
    return [];
  }

  const [rawCategories, allProducts] = await Promise.all([
    readCatalog("getCategoryRecords", [] as Category[], () => readCategories()),
    getProducts({ perPage: 100, card: true }),
  ]);

  return rawCategories.map((category) => {
    if (category.image) return category;
    const sampleProduct = allProducts.find(
      (product) =>
        product.images.length > 0 &&
        product.categories.some(
          (cat) =>
            cat.id === category.id ||
            cat.slug.toLowerCase() === category.slug.toLowerCase() ||
            cat.name.toLowerCase() === category.name.toLowerCase(),
        ),
    );
    if (!sampleProduct) return category;
    return {
      ...category,
      image: sampleProduct.images[0],
      imageAlt: sampleProduct.imageAlts[0] || category.name,
    };
  });
});

function parentCategories(all: Category[]): Category[] {
  return all
    .filter(
      (category) =>
        category.parent === 0 && category.slug.toLowerCase() !== "uncategorized",
    )
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getTopCategories(limit = 6): Promise<Category[]> {
  const all = await getCategoryRecords();
  return parentCategories(all).slice(0, limit);
}

/** Homepage catalog slots. Marine Electronics is replaced by 3D Printers. */
const HOME_CATEGORY_REPLACEMENTS: Record<string, string> = {
  "marine-electronics": "3d-printers",
};

export async function getHomeCategories(limit = 3): Promise<Category[]> {
  const parents = parentCategories(await getCategoryRecords());
  const bySlug = new Map(
    parents.map((category) => [category.slug.toLowerCase(), category]),
  );
  const picked: Category[] = [];
  const used = new Set<string>();

  for (const category of parents) {
    if (picked.length >= limit) break;
    const replacement =
      bySlug.get(HOME_CATEGORY_REPLACEMENTS[category.slug.toLowerCase()] ?? "");
    const next = replacement ?? category;
    const slug = next.slug.toLowerCase();
    if (used.has(slug)) continue;
    used.add(slug);
    picked.push(next);
  }

  return picked;
}

export async function getCategories(): Promise<string[]> {
  const categories = await getCategoryRecords();
  return Array.from(new Set(categories.map((entry) => entry.name))).sort();
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!isWooConfigured() || !isCatalogSlug(slug)) {
    return null;
  }

  return getProductOnce(slug);
}

export async function getCountries(): Promise<CountryOption[]> {
  if (!isWooConfigured()) return [];
  return cachedSoftWooCall(
    "data/countries",
    async () => {
      const data = await wooGet<
        Array<{
          code?: string;
          name?: string;
          states?: Array<{ code?: string; name?: string }>;
        }>
      >("data/countries");
      return data
        .filter((row) => row.code && row.name)
        .map((row) => ({
          code: normalizeCountryCode(String(row.code)),
          name: String(row.name),
          states: (row.states ?? [])
            .filter((state) => state.code && state.name)
            .map((state) => ({
              code: String(state.code),
              name: String(state.name),
            })),
        }));
    },
    [],
    "getCountries",
  );
}

export async function getDefaultCountry(): Promise<string> {
  if (!isWooConfigured()) return "";
  return cachedSoftWooCall(
    "default-country",
    async () => {
      const general = await wooGet<Array<{ id?: string; value?: string }>>(
        "settings/general",
      );
      const row = general.find((entry) => entry.id === "woocommerce_default_country");
      const value = row?.value || "";
      return value.split(":")[0] || "";
    },
    "",
    "getDefaultCountry",
  );
}

export function getSiteUrl(settings?: StoreSettings) {
  const fromSettings = settings?.seo.siteUrl?.replace(/\/$/, "");
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "";
}

type WooReview = {
  id?: number;
  product_id?: number;
  product_name?: string;
  reviewer?: string;
  date_created?: string;
  review?: string;
  rating?: number;
  verified?: boolean;
  status?: string;
};

function headerNumber(
  headers: Record<string, unknown>,
  name: string,
  fallback: number,
) {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(value) ? value : fallback;
}

function stripReviewHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function getProductReviewsPage(options?: {
  page?: number;
  perPage?: number;
}): Promise<ProductReviewsPage> {
  const page = Math.max(1, options?.page ?? 1);
  const perPage = Math.min(50, Math.max(1, options?.perPage ?? 20));
  const empty: ProductReviewsPage = {
    reviews: [],
    page,
    perPage,
    total: 0,
    totalPages: 0,
  };

  if (!isWooConfigured() || isWooUnreachable()) {
    return empty;
  }

  const [payload, catalog] = await Promise.all([
    cachedSoftWooCall(
      `reviews:${page}:${perPage}`,
      async () => {
        const { data, headers } = await wooGetWithHeaders<WooReview[]>(
          "products/reviews",
          {
            page,
            per_page: perPage,
            status: "approved",
            order: "desc",
            orderby: "date",
          },
        );
        return {
          data,
          total: headerNumber(headers, "x-wp-total", data.length),
          totalPages: headerNumber(headers, "x-wp-totalpages", 1),
        };
      },
      { data: [] as WooReview[], total: 0, totalPages: 0 },
      "getProductReviewsPage",
    ),
    getProducts({ perPage: 100 }),
  ]);

  const slugById = new Map(
    catalog.map((product) => [Number(product.id), product.slug]),
  );

  const reviews: ProductReview[] = payload.data.map((row) => ({
    id: Number(row.id) || 0,
    productId: String(row.product_id ?? ""),
    productName: String(row.product_name || "Product"),
    productSlug: slugById.get(Number(row.product_id)) || "",
    reviewer: String(row.reviewer || "Customer"),
    dateCreated: String(row.date_created || ""),
    rating: Math.min(5, Math.max(0, Number(row.rating) || 0)),
    content: stripReviewHtml(String(row.review || "")),
    verified: Boolean(row.verified),
  }));

  return {
    reviews,
    page,
    perPage,
    total: payload.total,
    totalPages: payload.totalPages,
  };
}

export async function getReviewCatalogStats(): Promise<ReviewCatalogStats> {
  const products = await getProducts({ perPage: 100 });
  let reviewCount = 0;
  let weighted = 0;
  for (const product of products) {
    const count = Number(product.ratingCount) || 0;
    if (count <= 0) continue;
    reviewCount += count;
    weighted += (Number(product.averageRating) || 0) * count;
  }
  return {
    reviewCount,
    averageRating: reviewCount > 0 ? weighted / reviewCount : 0,
  };
}

const ICON_LABELS: Record<PaymentIconSlug, string> = {
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

const ICON_ORDER: PaymentIconSlug[] = [
  "visa",
  "mastercard",
  "amex",
  "unionpay",
  "discover",
  "jcb",
  "diners",
  "paypal",
  "apple-pay",
  "google-pay",
  "affirm",
  "afterpay",
  "klarna",
  "link",
];

function stripeCardBrands(settings: StoreSettings): PaymentIconSlug[] {
  const allowed = new Set<PaymentIconSlug>([
    "visa",
    "mastercard",
    "amex",
    "discover",
    "jcb",
    "diners",
    "unionpay",
  ]);
  return (settings.productPage?.stripeCardBrands ?? []).filter((slug) =>
    allowed.has(slug),
  );
}

export async function getProductPaymentDisplay(
  settings: StoreSettings,
): Promise<ProductPaymentDisplay> {
  const slugs = new Set<PaymentIconSlug>();
  const accounts = await getPaymentAccounts();
  const stripeEnabled = Boolean(
    accounts.stripe.enabled &&
      accounts.stripe.secretKey &&
      accounts.stripe.publishableKey,
  );
  const paypalEnabled = Boolean(
    accounts.paypal.enabled && accounts.paypal.clientId && accounts.paypal.clientSecret,
  );
  const affirmEnabled = Boolean(
    accounts.affirm.enabled && accounts.affirm.publicKey && accounts.affirm.privateKey,
  );
  const afterpayEnabled = Boolean(
    accounts.afterpay.enabled && accounts.afterpay.merchantId && accounts.afterpay.secret,
  );

  if (stripeEnabled) {
    for (const slug of stripeCardBrands(settings)) slugs.add(slug);
  }
  if (paypalEnabled) slugs.add("paypal");
  if (affirmEnabled) slugs.add("affirm");
  if (afterpayEnabled) slugs.add("afterpay");

  return {
    stripeEnabled,
    paypalEnabled,
    affirmEnabled,
    afterpayEnabled,
    icons: ICON_ORDER.filter((slug) => slugs.has(slug)).map((slug) => ({
      slug,
      label: ICON_LABELS[slug],
    })),
  };
}

/** @deprecated Use getProductPaymentDisplay */
export async function getSecurePaymentIcons(settings: StoreSettings) {
  const display = await getProductPaymentDisplay(settings);
  return display.icons;
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Share2 } from "lucide-react";
import type {
  BnplPublicConfig,
  Product,
  ProductPaymentDisplay,
} from "@/lib/types";
import { defaultProductPage } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/lib/store-context";
import {
  addProductToCart,
  isCatalogConflictError,
  shopNowToCheckout,
} from "@/lib/add-to-cart";
import { userErrorMessage } from "@/lib/user-error";
import { useCartStore } from "@/lib/cart-store";
import { ProductRatingRow } from "@/components/ProductRatingRow";
import { SecurePaymentsBlock } from "@/components/SecurePaymentsBlock";
import { BnplMessaging } from "@/components/BnplMessaging";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { QuantityPicker } from "@/components/QuantityPicker";
import { StoreImage } from "@/components/StoreImage";
import { SmoothAccordion } from "@/components/SmoothAccordion";
import { pageContainer } from "@/lib/layout";
import { cn } from "@/lib/utils";

export function ProductDetail({
  product,
  payment,
  bnpl,
  related = [],
}: {
  product: Product;
  payment: ProductPaymentDisplay;
  bnpl: BnplPublicConfig;
  related?: Product[];
}) {
  const router = useRouter();
  const { settings } = useStore();
  const setError = useCartStore((state) => state.setError);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const cartLock = useRef(false);
  const [rejectedId, setRejectedId] = useState<string | null>(null);
  const inStock = product.inStock && rejectedId !== product.id;
  const [imageIndex, setImageIndex] = useState(0);
  const [shared, setShared] = useState(false);
  const page = settings.productPage ?? defaultProductPage;
  const category = product.categories[0];
  const slides = product.images.length ? product.images : [settings.logo];
  const active = slides[imageIndex] ?? slides[0];

  function noteConflict(error: unknown) {
    if (!isCatalogConflictError(error)) return;
    setRejectedId(product.id);
    router.refresh();
  }

  async function handleAdd() {
    if (!inStock || busy || cartLock.current) return;
    cartLock.current = true;
    setBusy(true);
    try {
      await addProductToCart(product, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1200);
    } catch (error) {
      noteConflict(error);
      setError(userErrorMessage(error, "Could not add to cart."));
    } finally {
      cartLock.current = false;
      setBusy(false);
    }
  }

  async function handleShopNow() {
    if (!inStock || busy || cartLock.current) return;
    cartLock.current = true;
    setBusy(true);
    try {
      await shopNowToCheckout(product, quantity, page.shopNowEmptyCart);
      // Stay locked while the checkout route loads so extra clicks do nothing.
      router.push("/checkout");
    } catch (error) {
      noteConflict(error);
      setError(
        userErrorMessage(error, "Could not start checkout."),
      );
      cartLock.current = false;
      setBusy(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 1400);
      }
    } catch {
      setShared(false);
    }
  }

  return (
    <div className={pageContainer("py-6 sm:py-8 lg:py-10")}>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/products" className="hover:text-foreground">
              Shop
            </Link>
          </li>
          {category ? (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/collection/${category.slug}`}
                  className="hover:text-foreground"
                >
                  {category.name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden>/</li>
          <li className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
        <div className="lg:sticky lg:top-24">
          <div className="flex items-start gap-2 sm:gap-3">
            {slides.length > 1 ? (
              <div className="hidden max-h-[640px] w-16 shrink-0 flex-col gap-2 overflow-y-auto sm:flex lg:w-[76px]">
                {slides.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setImageIndex(index)}
                    aria-label={`Show image ${index + 1}`}
                    aria-current={index === imageIndex ? "true" : undefined}
                    className={cn(
                      "relative aspect-square w-full shrink-0 overflow-hidden border bg-muted/40",
                      index === imageIndex
                        ? "border-foreground"
                        : "border-border hover:border-foreground/50",
                    )}
                  >
                    <StoreImage
                      src={src}
                      alt=""
                      fallbackSrc={settings.logo}
                      sizes="76px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="relative min-w-0 flex-1 overflow-hidden border border-border bg-background">
              {product.onSale ? (
                <span className="absolute top-3 left-3 z-10 bg-red-600 px-2 py-1 text-[11px] font-semibold tracking-wide text-white uppercase">
                  Sale
                </span>
              ) : null}
              <img
                src={active}
                alt={product.imageAlts[imageIndex] || product.name}
                className="block h-auto w-full"
              />
            </div>
          </div>

          {slides.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto sm:hidden">
              {slides.map((src, index) => (
                <button
                  key={`${src}-m-${index}`}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show image ${index + 1}`}
                  className={cn(
                    "relative size-16 shrink-0 overflow-hidden border bg-muted/40",
                    index === imageIndex ? "border-foreground" : "border-border",
                  )}
                >
                  <StoreImage
                    src={src}
                    alt=""
                    fallbackSrc={settings.logo}
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          <h1 className="text-2xl font-medium tracking-tight text-balance sm:text-[1.75rem]">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            {product.onSale && product.regularPrice > product.price ? (
              <p className="text-lg tabular-nums text-muted-foreground line-through">
                {formatPrice(product.regularPrice, settings)}
              </p>
            ) : null}
            <p className="text-2xl tabular-nums tracking-tight">
              {formatPrice(product.price, settings)}
            </p>
          </div>

          {page.enableRatingRow ? (
            <div className="mt-3">
              <ProductRatingRow product={product} />
            </div>
          ) : null}

          {(product.specGroups?.[0]?.rows.length ?? 0) > 0 ? (
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {product.specGroups[0].rows.slice(0, 6).map((row) => (
                <div key={row.label} className="flex justify-between gap-3 border-b border-border/70 py-1.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : product.description ? (
            <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          <div className="mt-4">
            <BnplMessaging
              product={product}
              settings={settings}
              config={bnpl}
              affirmEnabled={payment.affirmEnabled}
              afterpayEnabled={payment.afterpayEnabled}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <QuantityPicker
              id="quantity"
              value={quantity}
              disabled={!inStock}
              onChange={setQuantity}
              className="w-full justify-between rounded-none sm:w-auto"
            />
            <Button
              type="button"
              size="lg"
              className="w-full rounded-none sm:min-w-36 sm:w-auto"
              disabled={!inStock || busy}
              onClick={() => void handleAdd()}
            >
              {added
                ? "Added"
                : busy
                  ? "Adding..."
                  : inStock
                    ? "Add to cart"
                    : "Out of stock"}
            </Button>
            {page.enableShopNow && inStock ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full rounded-none sm:min-w-32 sm:w-auto"
                disabled={busy}
                onClick={() => void handleShopNow()}
              >
                {page.shopNowLabel || "Buy Now"}
              </Button>
            ) : null}
          </div>

          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            {inStock ? (
              <>
                <Check className="size-4 text-emerald-600" aria-hidden />
                In stock
              </>
            ) : (
              "Out of stock"
            )}
          </p>

          <SmoothAccordion
            className="mt-6"
            items={[
              {
                title: "Shipping and returns",
                content: (
                  <>
                    <p>Estimated delivery is 3 to 7 business days after processing.</p>
                    <p className="mt-2">
                      Eligible items may be returned within 30 days. Questions:{" "}
                      {settings.contact.email}
                      {settings.contact.phone ? ` or ${settings.contact.phone}` : ""}.
                    </p>
                  </>
                ),
              },
              {
                title: "Support",
                content: (
                  <p>
                    Live chat is available 24/7. Email {settings.contact.email}
                    {settings.contact.phone ? ` or call ${settings.contact.phone}` : ""}.
                  </p>
                ),
              },
            ]}
          />

          <button
            type="button"
            onClick={() => void handleShare()}
            className="mt-4 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Share2 className="size-4" aria-hidden />
            {shared ? "Link copied" : "Share"}
          </button>

          {page.enableSecureBlock ? (
            <div className="mt-6">
              <SecurePaymentsBlock icons={payment.icons} />
            </div>
          ) : null}
        </div>
      </div>

      <section className="mt-16 space-y-12 border-t border-border pt-10">
        {(product.specGroups ?? []).length > 0 ? (
          product.specGroups.map((group, groupIndex) => (
            <div key={`${group.title}-${groupIndex}`}>
              <h2 className="mb-4 text-lg font-medium">{group.title}</h2>
              <dl className="grid overflow-hidden border border-border sm:grid-cols-2">
                {group.rows.map((row, rowIndex) => (
                  <div
                    key={`${group.title}-${groupIndex}-${row.label}-${rowIndex}`}
                    className="grid grid-cols-1 border-b border-border last:border-b-0 sm:grid-cols-[minmax(8rem,0.8fr)_1.2fr] sm:[&:nth-last-child(-n+2)]:border-b-0"
                  >
                    <dt className="bg-muted/40 px-4 pt-3 pb-1 text-sm text-muted-foreground sm:py-3">
                      {row.label}
                    </dt>
                    <dd className="px-4 pt-1 pb-3 text-sm sm:py-3">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        ) : (
          <div>
            <h2 className="mb-4 text-lg font-medium">Description</h2>
            <div className="max-w-4xl text-[15px] leading-7 whitespace-pre-wrap text-foreground/90">
              {product.description ||
                "Product details are listed with this item. Contact us if you need more specifications before you order."}
            </div>
          </div>
        )}

        <dl className="flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-foreground">SKU:</dt>
            <dd>{product.sku || product.id}</dd>
          </div>
          {product.categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-foreground">Categories:</dt>
              <dd className="flex flex-wrap gap-x-3">
                {product.categories.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/collection/${entry.slug}`}
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {entry.name}
                  </Link>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {related.length > 0 ? (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="mb-8 text-center text-2xl font-medium tracking-tight">
            Related Products
          </h2>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

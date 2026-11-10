import { Suspense } from "react";
import type { Metadata } from "next";
import {
  ProductsCatalog,
  ProductsCatalogWithQuery,
} from "@/components/ProductsCatalog";
import { getProducts, getSiteSettings, getSiteUrl } from "@/lib/api";
import { toCardProduct } from "@/lib/catalog-card";
import { pageContainer } from "@/lib/layout";
import type { Product } from "@/lib/types";

function visibleCatalog(products: Product[]) {
  const names: string[] = [];
  for (const product of products) {
    const name = product.category.trim();
    if (!name || names.includes(name)) continue;
    names.push(name);
    if (names.length === 4) break;
  }
  const allowed = new Set(names);
  const counts = new Map<string, number>();
  return products.filter((product) => {
    if (!allowed.has(product.category)) return false;
    const used = counts.get(product.category) ?? 0;
    if (used >= 3) return false;
    counts.set(product.category, used + 1);
    return true;
  });
}

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteUrl = getSiteUrl(settings);

  return {
    title: "Shop",
    description: `Browse the ${settings.name} catalog. Filter by category and sort by price.`,
    robots: { index: true, follow: true },
    alternates: {
      canonical: siteUrl ? `${siteUrl}/products` : "/products",
    },
    openGraph: {
      title: `Shop | ${settings.name}`,
      description: `Browse products from ${settings.name}.`,
    },
  };
}

export default async function ProductsPage() {
  const [settings, products] = await Promise.all([
    getSiteSettings(),
    getProducts({ card: true }),
  ]);
  const visibleProducts = visibleCatalog(products).map(toCardProduct);

  return (
    <div className={pageContainer("space-y-8 py-10 sm:py-12")}>
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-sm font-medium text-primary">
          {settings.name} · Shop
        </p>
        <h1 className="font-display text-balance text-4xl sm:text-5xl">
          All products
        </h1>
        <p className="text-pretty text-muted-foreground">
          Search the catalog, filter by category, and sort by price.
        </p>
      </header>
      <Suspense fallback={<ProductsCatalog products={visibleProducts} />}>
        <ProductsCatalogWithQuery products={visibleProducts} />
      </Suspense>
    </div>
  );
}

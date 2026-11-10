import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductsCatalog } from "@/components/ProductsCatalog";
import { JsonLd } from "@/components/JsonLd";
import {
  getCategoryRecords,
  getProductsByCategory,
  getSiteSettings,
  getSiteUrl,
} from "@/lib/api";
import { toCardProduct } from "@/lib/catalog-card";
import { isCatalogSlug } from "@/lib/catalog-slug";
import { pageContainer } from "@/lib/layout";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const categories = await getCategoryRecords();
    return categories
      .map((category) => ({ slug: category.slug }))
      .filter((entry) => isCatalogSlug(entry.slug));
  } catch {
    return [];
  }
}

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isCatalogSlug(slug)) notFound();
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    getCategoryRecords(),
  ]);
  const category = categories.find((entry) => entry.slug === slug);
  const siteUrl = getSiteUrl(settings);

  if (!category) {
    return {
      title: "Category not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description =
    category.description ||
    `Shop ${category.name} at ${settings.name}.`;

  return {
    title: category.name,
    description,
    alternates: {
      canonical: siteUrl
        ? `${siteUrl}/collection/${category.slug}`
        : `/collection/${category.slug}`,
    },
    openGraph: {
      title: `${category.name} | ${settings.name}`,
      description,
      images: category.image
        ? [{ url: category.image, alt: category.imageAlt || category.name }]
        : undefined,
    },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  if (!isCatalogSlug(slug)) notFound();
  const [settings, categories] = await Promise.all([
    getSiteSettings(),
    getCategoryRecords(),
  ]);
  const category = categories.find((entry) => entry.slug === slug);

  if (!category) {
    notFound();
  }

  const products = (await getProductsByCategory(category.slug)).slice(0, 3);
  const siteUrl = getSiteUrl(settings);
  const url = siteUrl
    ? `${siteUrl}/collection/${category.slug}`
    : `/collection/${category.slug}`;

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description,
    url,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: siteUrl
          ? `${siteUrl}/products/${product.slug}`
          : `/products/${product.slug}`,
        name: product.name,
      })),
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl || "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: siteUrl ? `${siteUrl}/products` : "/products",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: category.name,
        item: url,
      },
    ],
  };

  return (
    <>
      <JsonLd data={collectionLd} />
      <JsonLd data={breadcrumbLd} />
      <div className={pageContainer("space-y-8 py-10 sm:py-12")}>
        <header className="space-y-3 border-b border-border pb-8">
          <p className="text-sm font-medium text-primary">
            Home / Shop / {category.name}
          </p>
          <h1 className="font-display text-balance text-4xl sm:text-5xl">
            {category.name}
          </h1>
          <p className="text-pretty text-muted-foreground">
            {category.description ||
              `${products.length} product${products.length === 1 ? "" : "s"} in this collection at ${settings.name}.`}
          </p>
        </header>
        <ProductsCatalog
          products={products.map(toCardProduct)}
          initialCategory={category.name}
        />
      </div>
    </>
  );
}

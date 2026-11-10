import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { JsonLd } from "@/components/JsonLd";
import {
  getProduct,
  getProducts,
  getProductPaymentDisplay,
  getProductsByCategory,
  getProductsByIds,
  getSiteSettings,
  getSiteUrl,
} from "@/lib/api";
import { getBnplPublicConfig } from "@/lib/bnpl-server";
import { toCardProduct } from "@/lib/catalog-card";
import { isCatalogSlug } from "@/lib/catalog-slug";
import type { ProductPaymentDisplay, BnplPublicConfig } from "@/lib/types";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const products = await getProducts({ perPage: 100, card: true });
    return products
      .map((product) => ({ slug: product.slug }))
      .filter((entry) => isCatalogSlug(entry.slug));
  } catch {
    return [];
  }
}

function emptyPayment(): ProductPaymentDisplay {
  return {
    stripeEnabled: false,
    paypalEnabled: false,
    affirmEnabled: false,
    afterpayEnabled: false,
    icons: [],
  };
}

function emptyBnpl(): BnplPublicConfig {
  return {
    affirmPublicKey: "",
    affirmEnv: "sandbox",
    afterpayMpid: "",
    afterpayPlacementId: "",
  };
}

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isCatalogSlug(slug)) notFound();
  const [settings, product] = await Promise.all([
    getSiteSettings(),
    getProduct(slug),
  ]);

  if (!product) {
    return {
      title: "Product niet gevonden",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const siteUrl = getSiteUrl(settings);
  const url = siteUrl
    ? `${siteUrl}/products/${product.slug}`
    : `/products/${product.slug}`;

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      title: `${product.name} | ${settings.name}`,
      description: product.description,
      url,
      images: product.images.map((imageUrl, index) => ({
        url: imageUrl,
        alt: product.imageAlts[index] || product.name,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${settings.name}`,
      description: product.description,
      images: product.images,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  if (!isCatalogSlug(slug)) notFound();
  const [settings, product] = await Promise.all([
    getSiteSettings(),
    getProduct(slug),
  ]);

  if (!product) {
    notFound();
  }

  const categorySlug = product.categories[0]?.slug;
  const relatedFromIds = product.relatedIds?.length
    ? await getProductsByIds(product.relatedIds.slice(0, 4))
    : [];
  const related =
    relatedFromIds.length > 0
      ? relatedFromIds.filter((item) => item.id !== product.id).slice(0, 4)
      : categorySlug
        ? (await getProductsByCategory(categorySlug))
            .filter((item) => item.id !== product.id)
            .slice(0, 4)
        : [];
  const relatedCards = related.map(toCardProduct);

  const siteUrl = getSiteUrl(settings);
  const url = siteUrl
    ? `${siteUrl}/products/${product.slug}`
    : `/products/${product.slug}`;

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku || product.id,
    category: product.category,
    brand: {
      "@type": "Brand",
      name: settings.name,
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.averageRating,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: settings.currency,
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url,
      seller: {
        "@type": "Organization",
        name: settings.name,
      },
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
        name: product.name,
        item: url,
      },
    ],
  };

  return (
    <>
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbLd} />
      <ProductDetail
        product={product}
        payment={await getProductPaymentDisplay(settings).catch(emptyPayment)}
        bnpl={await getBnplPublicConfig().catch(emptyBnpl)}
        related={relatedCards}
      />
    </>
  );
}

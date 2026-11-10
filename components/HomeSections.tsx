import type { Category, Product, StoreSettings } from "@/lib/types";
import type { CatalogTile } from "@/components/sections/NeedsSection";
import { HeroSection } from "@/components/sections/HeroSection";
import { NeedsSection } from "@/components/sections/NeedsSection";
import { TrustStripSection } from "@/components/sections/TrustStripSection";
import { FeaturedProductsSection } from "@/components/sections/FeaturedProductsSection";
import { StepsSection } from "@/components/sections/StepsSection";
import { CommitmentSection } from "@/components/sections/CommitmentSection";
import { StorySection } from "@/components/sections/StorySection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { SupportSection } from "@/components/sections/SupportSection";
import { FaqPreviewSection } from "@/components/sections/FaqPreviewSection";
import { NewsletterSection } from "@/components/sections/NewsletterSection";

/**
 * Homepage layout is owned by Next.js (design system).
 * Product and category cards are filled only from WooCommerce props.
 */
export function HomeSections({
  settings,
  products,
  categoryProducts = [],
  tiles = [],
}: {
  settings: StoreSettings;
  products: Product[];
  categoryProducts?: { category: Category; products: Product[] }[];
  tiles?: CatalogTile[];
}) {
  const heroImage = tiles.find((tile) => tile.image);
  const storyImage = tiles.find((tile) => tile.image && tile.image !== heroImage?.image) ?? heroImage;
  return (
    <div>
      <HeroSection
        settings={settings}
        image={heroImage?.image}
        imageAlt={heroImage?.alt}
        collections={tiles.map((tile) => ({ label: tile.title, href: tile.href }))}
      />
      <NeedsSection tiles={tiles} />
      <TrustStripSection />
      <FeaturedProductsSection groups={categoryProducts} products={products} />
      <StorySection
        settings={settings}
        image={storyImage?.image}
        imageAlt={storyImage?.alt}
      />
      <StepsSection />
      <ReviewsSection settings={settings} />
      <CommitmentSection />
      <SupportSection settings={settings} />
      <FaqPreviewSection />
      <NewsletterSection settings={settings} />
    </div>
  );
}

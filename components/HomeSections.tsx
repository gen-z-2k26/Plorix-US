import type { Category, Product, StoreSettings } from "@/lib/types";
import type { CatalogTile } from "@/components/sections/NeedsSection";
import { HERO_SCENE, STORY_SCENE } from "@/lib/landing-photos";
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
  return (
    <div>
      <HeroSection
        settings={settings}
        image={HERO_SCENE.src}
        imageAlt={HERO_SCENE.alt}
        collections={tiles.map((tile) => ({ label: tile.title, href: tile.href }))}
      />
      <NeedsSection tiles={tiles} />
      <TrustStripSection />
      <FeaturedProductsSection groups={categoryProducts} products={products} />
      <StorySection
        settings={settings}
        image={STORY_SCENE.src}
        imageAlt={STORY_SCENE.alt}
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

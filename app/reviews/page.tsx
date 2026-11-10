import type { Metadata } from "next";
import { pageContainer } from "@/lib/layout";
import { getSiteSettings } from "@/lib/api";
import { PageHero } from "@/components/PageHero";
import { ReviewsBoard } from "@/components/ReviewsBoard";
import { storeReviewSummary, storeReviews } from "@/lib/store-reviews";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Customer reviews",
  description:
    "110 Plorix reviews from shoppers across all 50 U.S. states, covering orders, packing, and delivery.",
};

export default async function ReviewsPage() {
  const settings = await getSiteSettings();
  const reviews = storeReviews();
  const { total, stateCount } = storeReviewSummary();

  return (
    <div className={pageContainer("py-10 sm:py-14")}>
      <PageHero
        current="Reviews"
        eyebrow={`${settings.name} · United States`}
        title={`${total} reviews from across the USA`}
        description={`${total} shopper reviews of ${settings.name} from ${stateCount} states. People wrote about the electronics they ordered, plus packing and delivery to their city. Filter by star rating or sort by date.`}
      />

      <div className="mt-10">
        <ReviewsBoard reviews={reviews} locale={settings.locale || "en-US"} />
      </div>
    </div>
  );
}

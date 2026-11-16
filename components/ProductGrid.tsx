import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { IntentLink as Link } from "@/components/IntentLink";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <p className="font-medium">No products found</p>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">
          Try another category or sort option, or clear your search. New
          products come straight from WooCommerce.
        </p>
        <Link
          href="/products"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "mt-5",
          )}
        >
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

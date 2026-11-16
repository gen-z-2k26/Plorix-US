import { wooGet } from "@/lib/api/client";
import { refreshCatalog, refreshProducts } from "@/lib/cache-policy";

type ProductStockRow = { id?: number; slug?: string; stock_status?: string };

function validIds(ids: Array<number | string | undefined>) {
  return [
    ...new Set(
      ids.map(Number).filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

/**
 * Refreshes only the products whose stock or price just changed. Listings are
 * rebuilt as well when one of them sold out, so shop and collection grids stop
 * offering it.
 */
export async function refreshProductsById(
  ids: Array<number | string | undefined>,
) {
  const include = validIds(ids);
  if (!include.length) return;

  let rows: ProductStockRow[];
  try {
    rows = await wooGet<ProductStockRow[]>("products", {
      include: include.join(","),
      per_page: include.length,
      _fields: "id,slug,stock_status",
    });
  } catch {
    // Without slugs, a full refresh is the only way to clear the stale pages.
    refreshCatalog();
    return;
  }

  if (rows.some((row) => row.stock_status === "outofstock")) {
    refreshCatalog();
    return;
  }
  refreshProducts(rows.map((row) => row.slug || ""));
}

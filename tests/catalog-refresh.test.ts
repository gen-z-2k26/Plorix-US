import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  wooGet: vi.fn(),
  refreshCatalog: vi.fn(),
  refreshProducts: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ wooGet: mocks.wooGet }));
vi.mock("@/lib/cache-policy", () => ({
  refreshCatalog: mocks.refreshCatalog,
  refreshProducts: mocks.refreshProducts,
}));

import { refreshProductsById } from "@/lib/api/catalog-refresh";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("refreshProductsById", () => {
  it("does nothing without valid product ids", async () => {
    await refreshProductsById([undefined, "", "abc", 0, -4, 1.5]);

    expect(mocks.wooGet).not.toHaveBeenCalled();
    expect(mocks.refreshProducts).not.toHaveBeenCalled();
    expect(mocks.refreshCatalog).not.toHaveBeenCalled();
  });

  it("looks up each product once with a minimal field set", async () => {
    mocks.wooGet.mockResolvedValue([]);

    await refreshProductsById([12, "12", "7", undefined]);

    expect(mocks.wooGet).toHaveBeenCalledTimes(1);
    expect(mocks.wooGet).toHaveBeenCalledWith("products", {
      include: "12,7",
      per_page: 2,
      _fields: "id,slug,stock_status",
    });
  });

  it("refreshes only the products that are still in stock", async () => {
    mocks.wooGet.mockResolvedValue([
      { id: 12, slug: "red-mug", stock_status: "instock" },
      { id: 7, slug: "blue-cup", stock_status: "onbackorder" },
    ]);

    await refreshProductsById([12, 7]);

    expect(mocks.refreshProducts).toHaveBeenCalledWith(["red-mug", "blue-cup"]);
    expect(mocks.refreshCatalog).not.toHaveBeenCalled();
  });

  it("refreshes the whole catalog when a product sold out", async () => {
    mocks.wooGet.mockResolvedValue([
      { id: 12, slug: "red-mug", stock_status: "instock" },
      { id: 7, slug: "blue-cup", stock_status: "outofstock" },
    ]);

    await refreshProductsById([12, 7]);

    expect(mocks.refreshCatalog).toHaveBeenCalledTimes(1);
    expect(mocks.refreshProducts).not.toHaveBeenCalled();
  });

  it("refreshes the whole catalog when WooCommerce cannot be reached", async () => {
    mocks.wooGet.mockRejectedValue(new Error("ECONNRESET"));

    await expect(refreshProductsById([12])).resolves.toBeUndefined();
    expect(mocks.refreshCatalog).toHaveBeenCalledTimes(1);
  });
});

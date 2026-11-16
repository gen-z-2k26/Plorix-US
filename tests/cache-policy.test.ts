import { beforeEach, describe, expect, it, vi } from "vitest";

const nextCache = vi.hoisted(() => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => nextCache);

import {
  CATALOG_TAG,
  STOCK_REVALIDATE_SECONDS,
  productTag,
  refreshCatalog,
  refreshProducts,
} from "@/lib/cache-policy";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("refreshProducts", () => {
  it("expires only the given products, once each", () => {
    refreshProducts(["red-mug", "blue-cup", "red-mug", ""]);

    expect(nextCache.updateTag.mock.calls).toEqual([
      [productTag("red-mug")],
      [productTag("blue-cup")],
    ]);
    expect(nextCache.revalidatePath.mock.calls).toEqual([
      ["/products/red-mug", undefined],
      ["/products/blue-cup", undefined],
    ]);
    expect(nextCache.updateTag).not.toHaveBeenCalledWith(CATALOG_TAG);
    expect(nextCache.revalidatePath).not.toHaveBeenCalledWith(
      "/products/[slug]",
      "page",
    );
  });

  it("falls back to revalidateTag outside a server action", () => {
    nextCache.updateTag.mockImplementation(() => {
      throw new Error("updateTag can only be called from a Server Action");
    });

    refreshProducts(["red-mug"]);

    expect(nextCache.revalidateTag).toHaveBeenCalledWith(productTag("red-mug"), {
      expire: 0,
    });
  });

  it("never throws when Next rejects every cache call", () => {
    const fail = () => {
      throw new Error("outside request");
    };
    nextCache.updateTag.mockImplementation(fail);
    nextCache.revalidateTag.mockImplementation(fail);
    nextCache.revalidatePath.mockImplementation(fail);

    expect(() => refreshProducts(["red-mug"])).not.toThrow();
    expect(() => refreshCatalog()).not.toThrow();
  });
});

describe("refreshCatalog", () => {
  it("expires the catalog tag and every catalog route", () => {
    refreshCatalog();

    expect(nextCache.updateTag).toHaveBeenCalledWith(CATALOG_TAG);
    expect(nextCache.revalidatePath.mock.calls).toEqual([
      ["/", undefined],
      ["/products", undefined],
      ["/products/[slug]", "page"],
      ["/collection/[slug]", "page"],
    ]);
  });
});

describe("productTag", () => {
  it("is distinct per product and from the catalog tag", () => {
    expect(productTag("a")).not.toBe(productTag("b"));
    expect(productTag("a")).not.toBe(CATALOG_TAG);
  });
});

describe("STOCK_REVALIDATE_SECONDS", () => {
  it("keeps catalog pages cached for at least an hour", () => {
    expect(STOCK_REVALIDATE_SECONDS).toBeGreaterThanOrEqual(3600);
  });
});

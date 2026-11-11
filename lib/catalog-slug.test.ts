import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCatalogSlug } from "./catalog-slug.ts";

describe("catalog slugs", () => {
  it("accepts a normal product slug", () => {
    assert.equal(isCatalogSlug("glass-kettle"), true);
  });

  it("accepts long WooCommerce product slugs", () => {
    assert.equal(
      isCatalogSlug(
        "40000-btu-80-single-stage-gas-furnace-14-width-upflow-horizontal-compare-to-goodman-gr9s800403an",
      ),
      true,
    );
  });

  it("rejects scanner paths before they hit WooCommerce", () => {
    assert.equal(isCatalogSlug("wp-login.php"), false);
    assert.equal(isCatalogSlug(".env"), false);
    assert.equal(isCatalogSlug("../etc/passwd"), false);
    assert.equal(isCatalogSlug("a".repeat(201)), false);
  });
});

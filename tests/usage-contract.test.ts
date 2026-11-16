import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source checks that keep Vercel usage low. They read files instead of
 * importing them, so they hold in every store built from this codebase.
 */

const root = join(__dirname, "..");

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function sourceFiles(dir: string): string[] {
  const full = join(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).flatMap((name) => {
    const path = join(full, name);
    if (statSync(path).isDirectory()) return sourceFiles(relative(root, path));
    return /\.(ts|tsx)$/.test(name) ? [relative(root, path)] : [];
  });
}

const CATALOG_ROUTES = [
  "app/page.tsx",
  "app/products/page.tsx",
  "app/products/[slug]/page.tsx",
  "app/collection/[slug]/page.tsx",
];

describe("catalog routes", () => {
  it.each(CATALOG_ROUTES)("%s revalidates at most hourly", (path) => {
    const match = read(path).match(/export const revalidate = (\d+);/);
    expect(match, `${path} must export a literal revalidate`).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(3600);
  });
});

describe("links to catalog pages", () => {
  const catalogHref = /href=\{?[`"']\/(products|collection)\b/;

  it.each(sourceFiles("components").filter((f) => !f.endsWith("IntentLink.tsx")))(
    "%s does not viewport-prefetch catalog pages",
    (path) => {
      const source = read(path);
      if (!catalogHref.test(source)) return;
      const usesNextLink = /^import Link from "next\/link";/m.test(source);
      const optedOut = /prefetch=\{false\}/.test(source);
      expect(
        !usesNextLink || optedOut,
        `${path} links to catalog pages with next/link. Import { IntentLink as Link } from "@/components/IntentLink" instead.`,
      ).toBe(true);
    },
  );

  it("IntentLink disables viewport prefetch", () => {
    expect(read("components/IntentLink.tsx")).toMatch(/prefetch=\{false\}/);
  });
});

describe("cache invalidation", () => {
  const allowed = new Set(["lib/cache-policy.ts", "lib/api/catalog-refresh.ts"]);

  it.each(
    [...sourceFiles("app"), ...sourceFiles("lib"), ...sourceFiles("components")].filter(
      (f) => !allowed.has(f),
    ),
  )("%s does not wipe the whole catalog directly", (path) => {
    expect(
      read(path),
      `${path} should call refreshProductsById so only the affected products rebuild.`,
    ).not.toMatch(/\brefreshCatalog\s*\(/);
  });

  it("product data is tagged per product", () => {
    expect(read("lib/api/index.ts")).toMatch(/productTag\(slug\)/);
  });
});

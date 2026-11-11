/** Woo public slugs. Dots and other scanner junk never reach the API. */
const CATALOG_SLUG = /^[a-z0-9](?:[a-z0-9]|[-_](?=[a-z0-9])){0,199}$/;

export function isCatalogSlug(value: string) {
  return CATALOG_SLUG.test(value);
}

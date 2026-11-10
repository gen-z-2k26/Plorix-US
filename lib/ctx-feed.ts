export const PUBLIC_STORE_ORIGIN = "https://plorix.us";

function originOf(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

/** Use the public storefront. A site URL that still points at WordPress must not win. */
export function feedStoreOrigin(wpOrigin: string, configured?: string) {
  const site = originOf(configured?.trim() || "");
  if (!site || site === wpOrigin) return PUBLIC_STORE_ORIGIN;
  try {
    const host = new URL(site).hostname.toLowerCase();
    if (
      host === "plorix.us" ||
      host === "www.plorix.us" ||
      host === "droviia.us" ||
      host === "www.droviia.us" ||
      host === "wp.droviia.us"
    ) {
      return PUBLIC_STORE_ORIGIN;
    }
  } catch {
    return PUBLIC_STORE_ORIGIN;
  }
  return site;
}

/** CTX writes WordPress permalinks. Keep media on that host; point product links at the storefront. */
export function rewriteProductLinks(xml: string, wpOrigin: string, storeOrigin: string) {
  if (!wpOrigin || !storeOrigin || wpOrigin === storeOrigin) return xml;
  const store = new URL(storeOrigin);

  return xml.replace(
    /<((?:g:)?)(link|canonical_link)>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/\1\2>/g,
    (match, ns: string, name: string, raw: string) => {
      let url: URL;
      try {
        url = new URL(raw.trim());
      } catch {
        return match;
      }
      if (
        url.origin !== wpOrigin &&
        url.hostname !== "wp.droviia.us" &&
        url.hostname !== "wp.plorix.us"
      ) {
        return match;
      }
      if (!url.pathname.startsWith("/product/") && url.pathname !== "/") return match;
      url.protocol = store.protocol;
      url.host = store.host;
      url.pathname = url.pathname.replace(/^\/product\//, "/products/");
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, "");
      return `<${ns}${name}>${url.toString()}</${ns}${name}>`;
    },
  );
}

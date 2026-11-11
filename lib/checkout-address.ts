export type RegionOption = { code: string; name: string };

const ALIASES: Record<string, string> = {
  UK: "GB",
  "UNITED KINGDOM": "GB",
  "GREAT BRITAIN": "GB",
  ENGLAND: "GB",
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
};

/**
 * WooCommerce publishes counties for these countries, but the address locale
 * does not require one. Treating the list as required blocks checkout.
 */
const OPTIONAL_REGION = new Set(["GB", "IE"]);

/** Native menus follow color-scheme. Light keeps option text readable in dark mode. */
export const NATIVE_SELECT_CLASS = "[color-scheme:light]";

export function normalizeCountryCode(value: string) {
  const raw = value.trim().toUpperCase();
  return ALIASES[raw] || raw;
}

export function stateIsRequired(country: string, stateCount: number) {
  if (stateCount <= 0) return false;
  return !OPTIONAL_REGION.has(normalizeCountryCode(country));
}

export function deliveryLabels(country: string) {
  const code = normalizeCountryCode(country);
  if (code === "GB") {
    return {
      region: "County (optional)",
      postcode: "Postcode",
      postcodeError: "Postcode is required.",
    };
  }
  if (code === "US") {
    return {
      region: "State",
      postcode: "ZIP code",
      postcodeError: "ZIP code is required.",
    };
  }
  return {
    region: "State / Province",
    postcode: "Postal code",
    postcodeError: "Postal code is required.",
  };
}

export function addressAfterCountryChange<T extends { country: string; state: string }>(
  address: T,
  country: string,
): T {
  return { ...address, country: normalizeCountryCode(country), state: "" };
}

export function regionError(country: string, state: string, states: RegionOption[]) {
  if (!stateIsRequired(country, states.length)) return "";
  const code = state.trim();
  if (!code || !states.some((entry) => entry.code === code)) return "State is required.";
  return "";
}

export function wooAddressFields(address: {
  state: string;
  postcode: string;
  country: string;
}) {
  const country = normalizeCountryCode(address.country);
  return {
    country,
    postcode: country === "GB" ? address.postcode.trim().toUpperCase() : address.postcode.trim(),
    state: address.state.trim(),
  };
}

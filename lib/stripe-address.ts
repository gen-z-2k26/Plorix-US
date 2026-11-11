import type { Address } from "@/lib/types";
import { normalizeCountryCode } from "@/lib/checkout-address";

export function stripePersonName(address: Address) {
  return `${address.firstName} ${address.lastName}`.trim();
}

export function splitPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function stripeShippingRateId(packageId: number, rateId: string) {
  return `${packageId}::${rateId}`;
}

export function parseStripeShippingRateId(id: string) {
  const index = id.indexOf("::");
  if (index <= 0) return null;
  const packageId = Number(id.slice(0, index));
  const rateId = id.slice(index + 2);
  if (!Number.isInteger(packageId) || !rateId) return null;
  return { packageId, rateId };
}

function stripeCountry(value: string) {
  const raw = normalizeCountryCode(value);
  if (raw.length === 2) return raw;
  return raw.slice(0, 2);
}

export function stripeAddressFields(address: Address) {
  const fields: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  } = {
    line1: address.address1.trim(),
    city: address.city.trim(),
    postal_code: address.postcode.trim(),
    country: stripeCountry(address.country),
  };
  if (address.address2.trim()) fields.line2 = address.address2.trim();
  if (address.state.trim()) fields.state = address.state.trim();
  return fields;
}

export function stripeShippingParams(address: Address) {
  return {
    name: stripePersonName(address),
    phone: address.phone.trim() || undefined,
    address: stripeAddressFields(address),
  };
}

export function stripeBillingDetails(address: Address, email: string) {
  return {
    name: stripePersonName(address),
    email: email.trim() || address.email.trim() || undefined,
    phone: address.phone.trim() || undefined,
    address: stripeAddressFields(address),
  };
}

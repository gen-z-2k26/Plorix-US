import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getPaymentAccounts, reignMode } from "@/lib/payment-config";
import type { Address } from "@/lib/types";

const SANDBOX = "https://api.reign-sandbox.com";
const LIVE = "https://api.reign.com";
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Woo order meta that ties a pending order to its Reign payment session. */
export const REIGN_SESSION_META = "_reign_payment_session";

export type ReignSessionStatus =
  | "requires_payment_method"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "expired"
  | (string & {});

export type ReignPaymentSession = {
  id: string;
  status: ReignSessionStatus;
  amount?: { amount: number; currency: string };
  clientSecret?: string;
  orderId?: string | null;
  lastError?: { code?: string; message?: string; shopperMessage?: string } | null;
};

type ReignProblem = { code?: string; detail?: string; title?: string };

async function reignAccount() {
  const accounts = await getPaymentAccounts();
  return accounts.reign;
}

function reignBase(secretKey: string) {
  return reignMode(secretKey, "") === "live" ? LIVE : SANDBOX;
}

export async function isReignConfigured() {
  const account = await reignAccount();
  return Boolean(account.publishableKey && account.secretKey && account.scriptSrc);
}

export async function getReignWebhookSecret() {
  return (await reignAccount()).webhookSecret;
}

async function reignFetch<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string; secretKey?: string } = {},
): Promise<{ ok: boolean; status: number; data: T & ReignProblem }> {
  const secretKey = init.secretKey?.trim() || (await reignAccount()).secretKey;
  if (!secretKey) throw new Error("Add the Reign keys first.");
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const response = await fetch(`${reignBase(secretKey)}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & ReignProblem;
  return { ok: response.ok, status: response.status, data };
}

function problemMessage(data: ReignProblem, fallback: string) {
  return data.detail || data.title || fallback;
}

/** A read of an id that cannot exist only answers 404 when the key itself is accepted. */
export async function pingReign(secretKey?: string) {
  const { status, data } = await reignFetch("/v1/payment-sessions/ps_connectioncheck", {
    secretKey,
  });
  if (status === 401) throw new Error("Reign rejected the secret key.");
  if (status === 403) throw new Error(problemMessage(data, "This key cannot take payments."));
  if (status !== 404 && status >= 400) {
    throw new Error(problemMessage(data, "Could not reach Reign."));
  }
}

export function toReignCents(amount: number | string) {
  return Math.round(Number(amount || 0) * 100);
}

function countryCode(value: string) {
  const raw = value.trim().toUpperCase();
  if (raw === "USA" || raw === "UNITED STATES") return "US";
  return raw.slice(0, 2);
}

function reignAddress(address: Address) {
  return {
    firstName: address.firstName.trim().slice(0, 100) || "Customer",
    lastName: address.lastName.trim().slice(0, 100) || "-",
    address1: address.address1.trim(),
    address2: address.address2.trim() || undefined,
    city: address.city.trim(),
    provinceCode: address.state.trim() || undefined,
    zip: address.postcode.trim(),
    countryCode: countryCode(address.country),
    phone: address.phone.trim() || undefined,
  };
}

export async function createReignSession(input: {
  orderId: string;
  amount: number;
  currency: string;
  email: string;
  shipping: Address;
  billing: Address;
  needsShipping: boolean;
}) {
  if (input.currency.trim().toUpperCase() !== "USD") {
    throw new Error("Reign only takes payments in US dollars.");
  }
  const cents = toReignCents(input.amount);
  if (cents < 1) throw new Error("This order has nothing to pay.");
  const { ok, data } = await reignFetch<ReignPaymentSession>("/v1/payment-sessions", {
    method: "POST",
    idempotencyKey: randomUUID(),
    body: {
      lineItems: [
        {
          name: `Order #${input.orderId}`,
          quantity: 1,
          unitPrice: { amount: cents, currency: "USD" },
        },
      ],
      customer: {
        email: input.email.trim(),
        firstName: input.billing.firstName.trim().slice(0, 100) || "Customer",
        lastName: input.billing.lastName.trim().slice(0, 100) || "-",
        phone: input.billing.phone.trim().slice(0, 32) || undefined,
      },
      billingAddress: reignAddress(input.billing),
      ...(input.needsShipping ? { shippingAddress: reignAddress(input.shipping) } : {}),
      threeDs: "automatic",
    },
  });
  if (!ok || !data.id) {
    throw new Error(problemMessage(data, "Could not start the card payment."));
  }
  if (!data.clientSecret) {
    throw new Error("Card fields are not turned on for this Reign integration yet.");
  }
  return { id: data.id, clientSecret: data.clientSecret };
}

export async function getReignSession(sessionId: string) {
  if (!/^ps_[A-Za-z0-9]+$/.test(sessionId)) {
    throw new Error("Payment confirmation is incomplete.");
  }
  const { ok, data } = await reignFetch<ReignPaymentSession>(
    `/v1/payment-sessions/${encodeURIComponent(sessionId)}`,
  );
  if (!ok) throw new Error(problemMessage(data, "Could not read the Reign payment."));
  return data;
}

export function reignSessionPaidAmountMatches(session: ReignPaymentSession, total: number | string) {
  return (
    session.amount?.currency?.toUpperCase() === "USD" &&
    session.amount.amount === toReignCents(total)
  );
}

export function verifyReignSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret || !header) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (key === "t" && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (timestamp === null || !signatures.length) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

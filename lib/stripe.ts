import Stripe from "stripe";
import { getPaymentAccounts } from "@/lib/payment-config";

export {
  stripeAmountMatches,
  toStripeAmount,
  toStripeMinor,
} from "@/lib/stripe-amount";

let stripeCache: { key: string; client: Stripe } | null = null;

function envYes(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

/** Local-only. Skips Stripe charge; Woo order is still created and set paid. */
export function isMockPaymentEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return envYes(process.env.SKIP_STRIPE_PAYMENT);
}

export function mockPaymentIntentId(orderId: string) {
  return `dev_mock_${orderId.trim()}`;
}

export function isMockPaymentIntentId(id: string) {
  return id.startsWith("dev_mock_");
}

export async function isStripeConfigured() {
  const accounts = await getPaymentAccounts();
  return Boolean(accounts.stripe.secretKey);
}

export async function getStripeWebhookSecret() {
  const accounts = await getPaymentAccounts();
  return accounts.stripe.webhookSecret;
}

/** Pass fresh only from admin actions. Each fresh read is an uncached Blob request. */
export async function getStripe(options?: { fresh?: boolean }): Promise<Stripe> {
  const accounts = await getPaymentAccounts({ fresh: options?.fresh });
  const key = accounts.stripe.secretKey;
  if (!key) {
    throw new Error("Stripe is not configured. Add a secret key in Admin.");
  }
  if (!stripeCache || stripeCache.key !== key) {
    stripeCache = { key, client: new Stripe(key) };
  }
  return stripeCache.client;
}

function walletDomainCandidates(extraHosts: string[] = []) {
  const hosts = new Set<string>();
  const add = (value: string | undefined) => {
    const raw = value?.trim();
    if (!raw) return;
    let host = raw;
    try {
      host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    } catch {
      return;
    }
    host = host.toLowerCase();
    if (
      !host.includes(".") ||
      host === "localhost" ||
      host.endsWith(".local") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)
    ) {
      return;
    }
    hosts.add(host);
    if (host.startsWith("www.")) hosts.add(host.slice(4));
    else if (host.split(".").length === 2) hosts.add(`www.${host}`);
  };
  add(process.env.NEXT_PUBLIC_SITE_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  for (const host of extraHosts) add(host);
  return [...hosts];
}

/**
 * Apple Pay, Google Pay, Link, and Amazon Pay only render on domains that are
 * registered with the Stripe account. Safe to call repeatedly.
 */
export async function ensureStripeWalletDomains(extraHosts: string[] = []) {
  const accounts = await getPaymentAccounts({ fresh: true });
  if (!accounts.stripe.enabled || !accounts.stripe.secretKey) return [];
  const wanted = walletDomainCandidates(extraHosts);
  if (!wanted.length) return [];
  const stripe = await getStripe({ fresh: true });
  const existing = new Map<string, { id: string; enabled: boolean }>();
  for await (const domain of stripe.paymentMethodDomains.list({ limit: 100 })) {
    existing.set(domain.domain_name.toLowerCase(), {
      id: domain.id,
      enabled: domain.enabled,
    });
  }
  const results: { domain: string; status: "registered" | "enabled" | "ok" | "failed" }[] = [];
  for (const domain of wanted) {
    const found = existing.get(domain);
    try {
      if (!found) {
        await stripe.paymentMethodDomains.create({ domain_name: domain, enabled: true });
        results.push({ domain, status: "registered" });
      } else if (!found.enabled) {
        await stripe.paymentMethodDomains.update(found.id, { enabled: true });
        await stripe.paymentMethodDomains.validate(found.id);
        results.push({ domain, status: "enabled" });
      } else {
        results.push({ domain, status: "ok" });
      }
    } catch (error) {
      console.error("Stripe wallet domain registration failed", domain, error);
      results.push({ domain, status: "failed" });
    }
  }
  return results;
}

export async function pingStripe(secretKey?: string) {
  const key = secretKey?.trim() || (await getPaymentAccounts()).stripe.secretKey;
  if (!key) throw new Error("Add the keys first.");
  const stripe = new Stripe(key);
  await stripe.balance.retrieve();
}

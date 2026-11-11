"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { cartErrorMessage, publicError, type PublicResult } from "@/lib/cart-result";
import { pingAffirm } from "@/lib/affirm";
import { pingAfterpay } from "@/lib/afterpay";
import {
  adminAuthReady,
  adminPasswordMatches,
  clearAdminSession,
  createAdminSession,
  requireAdmin,
} from "@/lib/admin-session";
import { pingPayPal } from "@/lib/paypal";
import { pingReign } from "@/lib/reign";
import {
  clearProviderSecrets,
  getAdminPaymentView,
  savePaymentSettings,
  type AdminPaymentView,
  type PaymentMode,
  type PaymentProviderId,
  type PaymentSettingsInput,
} from "@/lib/payment-config";
import { ensureStripeWalletDomains, pingStripe } from "@/lib/stripe";

async function adminHost() {
  const headerList = await headers();
  return headerList.get("x-forwarded-host") || headerList.get("host") || "";
}

const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(headerList: Headers) {
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "local"
  );
}

function allow(key: string) {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

export async function loginAdminAction(password: string): Promise<PublicResult<true>> {
  try {
    const headerList = await headers();
    if (!allow(clientKey(headerList))) {
      return publicError(
        new Error("Too many attempts. Wait a minute and try again."),
        "Invalid credentials.",
      );
    }
    if (!adminAuthReady() || !adminPasswordMatches(password)) {
      return publicError(new Error("Invalid credentials."), "Invalid credentials.");
    }
    await createAdminSession();
    redirect("/admin");
  } catch (error) {
    unstable_rethrow(error);
    return publicError(error, "Invalid credentials.");
  }
}

export async function logoutAdminAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function savePaymentSettingsAction(
  input: PaymentSettingsInput,
): Promise<PublicResult<AdminPaymentView>> {
  try {
    await requireAdmin();
    await savePaymentSettings(input);
    if (input.stripe.enabled) {
      try {
        await ensureStripeWalletDomains([await adminHost()]);
      } catch (error) {
        console.error("Stripe wallet domains could not be checked", error);
      }
    }
    return { ok: true, data: await getAdminPaymentView() };
  } catch (error) {
    unstable_rethrow(error);
    return publicError(error, "Could not save.");
  }
}

export async function clearProviderAction(
  provider: PaymentProviderId,
): Promise<PublicResult<AdminPaymentView>> {
  try {
    await requireAdmin();
    await clearProviderSecrets(provider);
    return { ok: true, data: await getAdminPaymentView() };
  } catch (error) {
    unstable_rethrow(error);
    return publicError(error, "Could not clear credentials.");
  }
}

export type PaymentConnectionDraft = {
  stripe?: { secretKey?: string };
  paypal?: { mode?: PaymentMode; clientId?: string; clientSecret?: string };
  affirm?: { mode?: PaymentMode; publicKey?: string; privateKey?: string };
  afterpay?: { mode?: PaymentMode; merchantId?: string; secret?: string };
  reign?: { secretKey?: string };
};

export async function testProviderAction(
  provider: PaymentProviderId,
  draft?: PaymentConnectionDraft,
) {
  try {
    await requireAdmin();
    if (provider === "stripe") {
      await pingStripe(draft?.stripe?.secretKey);
      if (!draft?.stripe?.secretKey) {
        const domains = await ensureStripeWalletDomains([await adminHost()]);
        const failed = domains.filter((entry) => entry.status === "failed");
        if (failed.length) {
          return {
            ok: false as const,
            message: `Connected, but wallet domains could not be registered: ${failed
              .map((entry) => entry.domain)
              .join(", ")}.`,
          };
        }
      }
    } else if (provider === "paypal") {
      await pingPayPal(draft?.paypal);
    } else if (provider === "affirm") {
      await pingAffirm(draft?.affirm);
    } else if (provider === "reign") {
      await pingReign(draft?.reign?.secretKey);
    } else {
      await pingAfterpay(draft?.afterpay);
    }
    return { ok: true as const, message: "Connection succeeded." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      message: cartErrorMessage(error, "Connection failed."),
    };
  }
}

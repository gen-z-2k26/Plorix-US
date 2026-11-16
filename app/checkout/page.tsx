import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutPage } from "@/components/CheckoutPage";
import { restoreAbandonedCartFromToken } from "@/lib/api/recover-abandoned-cart";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutRoute({
  searchParams,
}: {
  searchParams: Promise<{ wcf_ac_token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.wcf_ac_token)
    ? params.wcf_ac_token[0]
    : params.wcf_ac_token;
  if (token?.trim()) {
    try {
      await restoreAbandonedCartFromToken(token);
    } catch {
      // Open checkout even if the saved cart cannot be copied.
    }
    redirect("/checkout");
  }
  return <CheckoutPage />;
}

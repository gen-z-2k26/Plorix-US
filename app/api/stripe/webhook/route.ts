import { NextResponse } from "next/server";
import {
  cancelUnpaidOrder,
  failUnpaidOrder,
  getOrder,
  markOrderPaid,
} from "@/lib/api";
import { getStripe, getStripeWebhookSecret, stripeAmountMatches } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = (await getStripeWebhookSecret()).trim();
  if (!secret) {
    console.warn("[stripe webhook] secret is not configured; event ignored");
    return NextResponse.json({ received: true, ignored: "no webhook secret" });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = (await getStripe()).webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type !== "payment_intent.succeeded" &&
    event.type !== "payment_intent.payment_failed" &&
    event.type !== "payment_intent.canceled"
  ) {
    return NextResponse.json({ received: true });
  }

  const intent = event.data.object;
  const orderId = intent.metadata?.woo_order_id;
  if (!orderId) {
    return NextResponse.json({ received: true });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const order = await getOrder(orderId);
      if (
        !stripeAmountMatches(
          order.total || 0,
          order.currency || "",
          intent.amount,
          intent.currency,
        )
      ) {
        console.warn("[stripe webhook] amount mismatch", {
          orderId,
          intentId: intent.id,
        });
        return NextResponse.json({ received: true, ignored: "amount mismatch" });
      }
      await markOrderPaid(orderId, intent.id);
    } else if (event.type === "payment_intent.payment_failed") {
      await failUnpaidOrder(orderId);
    } else {
      await cancelUnpaidOrder(orderId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    console.warn("[stripe webhook]", message, { orderId, intentId: intent.id });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

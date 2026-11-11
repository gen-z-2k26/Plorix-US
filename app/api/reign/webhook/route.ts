import { NextResponse } from "next/server";
import {
  cancelUnpaidOrder,
  findUnpaidOrderByMeta,
  markOrderPaid,
} from "@/lib/api";
import {
  getReignSession,
  getReignWebhookSecret,
  REIGN_SESSION_META,
  reignSessionPaidAmountMatches,
  verifyReignSignature,
} from "@/lib/reign";

export const dynamic = "force-dynamic";

type ReignEvent = {
  type?: string;
  data?: { object?: { id?: string }; id?: string };
  object?: { id?: string };
};

function sessionIdFrom(event: ReignEvent) {
  const id = event.data?.object?.id || event.data?.id || event.object?.id || "";
  return id.startsWith("ps_") ? id : "";
}

export async function POST(request: Request) {
  const secret = (await getReignWebhookSecret()).trim();
  if (!secret) {
    return NextResponse.json({ error: "Reign webhook secret is not configured." }, { status: 500 });
  }

  const body = await request.text();
  if (!verifyReignSignature(body, request.headers.get("reign-signature"), secret)) {
    return NextResponse.json({ error: "Invalid Reign signature." }, { status: 400 });
  }

  let event: ReignEvent;
  try {
    event = JSON.parse(body) as ReignEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (event.type !== "payment_session.succeeded" && event.type !== "payment_session.expired") {
    return NextResponse.json({ received: true });
  }
  const sessionId = sessionIdFrom(event);
  if (!sessionId) return NextResponse.json({ received: true });

  try {
    const order = await findUnpaidOrderByMeta(REIGN_SESSION_META, sessionId);
    if (!order) return NextResponse.json({ received: true });
    const orderId = String(order.id);
    const session = await getReignSession(sessionId);
    if (session.status === "succeeded") {
      if (!reignSessionPaidAmountMatches(session, order.total || 0)) {
        console.warn("[reign webhook] amount mismatch", { orderId, sessionId });
        return NextResponse.json({ error: "Amount mismatch." }, { status: 409 });
      }
      await markOrderPaid(orderId, session.id, {
        paymentMethod: "reign",
        paymentMethodTitle: "Credit card (Reign)",
      });
    } else if (session.status === "expired" && order.status === "pending") {
      await cancelUnpaidOrder(orderId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    console.warn("[reign webhook]", message, { sessionId });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

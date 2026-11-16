import { getPaymentAccounts } from "@/lib/payment-config";

const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";

async function paypalAccount() {
  const accounts = await getPaymentAccounts();
  return accounts.paypal;
}

function paypalBase(mode: "sandbox" | "live") {
  return mode === "live" ? LIVE : SANDBOX;
}

export async function isPayPalConfigured() {
  const account = await paypalAccount();
  return Boolean(account.clientId && account.clientSecret);
}

export async function payPalClientId() {
  const account = await paypalAccount();
  return account.clientId;
}

async function paypalToken(override?: {
  mode?: "sandbox" | "live";
  clientId?: string;
  clientSecret?: string;
}) {
  const account = await paypalAccount();
  const mode = override?.mode || account.mode;
  const id = override?.clientId?.trim() || account.clientId;
  const secret = override?.clientSecret?.trim() || account.clientSecret;
  if (!id || !secret) throw new Error("Add the keys first.");
  const response = await fetch(`${paypalBase(mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || "Could not start PayPal.");
  }
  return data.access_token;
}

export async function pingPayPal(override?: {
  mode?: "sandbox" | "live";
  clientId?: string;
  clientSecret?: string;
}) {
  await paypalToken(override);
}

export async function createPayPalOrder(input: {
  orderId: string;
  amount: number;
  currency: string;
}) {
  const account = await paypalAccount();
  const token = await paypalToken();
  const response = await fetch(`${paypalBase(account.mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.orderId,
          custom_id: input.orderId,
          amount: {
            currency_code: input.currency.trim().toUpperCase(),
            value: input.amount.toFixed(2),
          },
        },
      ],
    }),
  });
  const data = (await response.json()) as { id?: string; message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message || "Could not start PayPal.");
  }
  return data.id;
}

type PayPalOrderBody = {
  status?: string;
  name?: string;
  message?: string;
  details?: Array<{ issue?: string; description?: string }>;
  purchase_units?: Array<{
    custom_id?: string;
    reference_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { value?: string; currency_code?: string };
      }>;
    };
  }>;
};

function completedCapture(data: PayPalOrderBody) {
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((entry) => entry.status === "COMPLETED") ||
    unit?.payments?.captures?.[0];
  if (data.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id) {
    return null;
  }
  return {
    captureId: capture.id,
    orderId: unit?.custom_id || unit?.reference_id || "",
    amount: Number(capture.amount?.value || 0),
    currency: capture.amount?.currency_code || "",
  };
}

export async function capturePayPalOrder(paypalOrderId: string) {
  const account = await paypalAccount();
  const token = await paypalToken();
  const base = paypalBase(account.mode);
  const response = await fetch(
    `${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = (await response.json()) as PayPalOrderBody;
  const captured = completedCapture(data);
  if (response.ok && captured) return captured;
  const issue = data.details?.[0]?.issue || "";
  if (issue === "ORDER_ALREADY_CAPTURED" || data.status === "COMPLETED") {
    const existing = await fetch(
      `${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const order = (await existing.json()) as PayPalOrderBody;
    const already = completedCapture(order);
    if (existing.ok && already) return already;
  }
  throw new Error(
    data.details?.[0]?.description || data.message || "PayPal capture failed.",
  );
}

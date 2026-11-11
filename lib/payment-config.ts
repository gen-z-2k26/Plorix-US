import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { get, put } from "@vercel/blob";

export type PaymentMode = "sandbox" | "live";
export type PaymentProviderId = "stripe" | "paypal" | "affirm" | "afterpay" | "reign";
export type ProviderStatus = "live" | "sandbox" | "off" | "needs_keys";

type StripeSecrets = {
  enabled: boolean;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
};

type PaypalSecrets = {
  enabled: boolean;
  mode: PaymentMode;
  clientId: string;
  clientSecret: string;
};

type AffirmSecrets = {
  enabled: boolean;
  mode: PaymentMode;
  publicKey: string;
  privateKey: string;
};

type AfterpaySecrets = {
  enabled: boolean;
  mode: PaymentMode;
  merchantId: string;
  secret: string;
  mpid: string;
  placementId: string;
};

type ReignSecrets = {
  enabled: boolean;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  scriptSrc: string;
  scriptIntegrity: string;
};

type StoredPaymentConfig = {
  stripe: StripeSecrets;
  paypal: PaypalSecrets;
  affirm: AffirmSecrets;
  afterpay: AfterpaySecrets;
  reign: ReignSecrets;
};

export type PaymentAccounts = StoredPaymentConfig & { managed: boolean };

export type AdminPaymentView = {
  keyReady: boolean;
  blobReady: boolean;
  managed: boolean;
  liveCount: number;
  stripe: {
    enabled: boolean;
    publishableKey: string;
    secretHint: string;
    webhookHint: string;
    status: ProviderStatus;
  };
  paypal: {
    enabled: boolean;
    mode: PaymentMode;
    clientId: string;
    secretHint: string;
    status: ProviderStatus;
  };
  affirm: {
    enabled: boolean;
    mode: PaymentMode;
    publicKey: string;
    secretHint: string;
    status: ProviderStatus;
  };
  afterpay: {
    enabled: boolean;
    mode: PaymentMode;
    merchantId: string;
    secretHint: string;
    mpid: string;
    placementId: string;
    status: ProviderStatus;
  };
  reign: {
    enabled: boolean;
    publishableKey: string;
    secretHint: string;
    webhookHint: string;
    scriptTag: string;
    status: ProviderStatus;
  };
};

export type PaymentSettingsInput = {
  stripe: {
    enabled: boolean;
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  paypal: {
    enabled: boolean;
    mode: PaymentMode;
    clientId: string;
    clientSecret: string;
  };
  affirm: {
    enabled: boolean;
    mode: PaymentMode;
    publicKey: string;
    privateKey: string;
  };
  afterpay: {
    enabled: boolean;
    mode: PaymentMode;
    merchantId: string;
    secret: string;
  };
  reign: {
    enabled: boolean;
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    scriptTag: string;
  };
};

const BLOB_PATH = "payments/config.enc";
const PAYMENT_CONFIG_TAG = "payment-config";
/**
 * Process-local copy so checkout requests do not hit the data cache on every
 * call. Other instances pick up an admin save within this window.
 * Admin saves on this instance replace it immediately.
 */
const MEMORY_TTL_MS = 5 * 60 * 1000;
/** After a failed Blob read with nothing cached, try again this soon. */
const ERROR_RETRY_MS = 30 * 1000;

class EnvelopeMissingError extends Error {}

type EnvelopeCache = { found: false } | { found: true; raw: string };

let memory: { raw: string | null; at: number } | null = null;
let inflight: Promise<string | null> | null = null;

function encryptionKey() {
  const raw = process.env.PAYMENT_CONFIG_KEY?.trim() || "";
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function paymentConfigKeyReady() {
  return Boolean(encryptionKey());
}

function blobTokenReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function emptyStored(): StoredPaymentConfig {
  return {
    stripe: { enabled: false, publishableKey: "", secretKey: "", webhookSecret: "" },
    paypal: { enabled: false, mode: "sandbox", clientId: "", clientSecret: "" },
    affirm: { enabled: false, mode: "sandbox", publicKey: "", privateKey: "" },
    afterpay: {
      enabled: false,
      mode: "sandbox",
      merchantId: "",
      secret: "",
      mpid: "",
      placementId: "",
    },
    reign: {
      enabled: false,
      publishableKey: "",
      secretKey: "",
      webhookSecret: "",
      scriptSrc: "",
      scriptIntegrity: "",
    },
  };
}

export function reignScriptTag(src: string, integrity: string) {
  if (!src) return "";
  return `<script src="${src}" integrity="${integrity}" crossorigin="anonymous"></script>`;
}

const REIGN_SCRIPT_HOSTS: Record<PaymentMode, string> = {
  sandbox: "js.reign-sandbox.com",
  live: "js.reign.com",
};

/** Reads src and integrity from the tag the Reign portal hands out. */
function parseReignScriptTag(tag: string, mode: PaymentMode) {
  const trimmed = tag.trim();
  if (!trimmed) return { src: "", integrity: "" };
  const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(trimmed)?.[1]?.trim() || "";
  const integrity = /\bintegrity\s*=\s*["']([^"']+)["']/i.exec(trimmed)?.[1]?.trim() || "";
  let host = "";
  try {
    const url = new URL(src);
    host = url.protocol === "https:" ? url.hostname : "";
  } catch {
    host = "";
  }
  if (!host) throw new Error("Paste the full Reign.js script tag from the Reign portal.");
  if (host !== REIGN_SCRIPT_HOSTS[mode]) {
    throw new Error(
      `Reign.js must load from ${REIGN_SCRIPT_HOSTS[mode]} for ${mode === "live" ? "live" : "test"} keys.`,
    );
  }
  if (!/^sha(256|384|512)-[A-Za-z0-9+/=]{40,}$/.test(integrity) || /^sha\d+-A+=*$/.test(integrity)) {
    throw new Error("The Reign.js script tag needs its real integrity hash from the Reign portal.");
  }
  return { src, integrity };
}

export function maskSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "Saved";
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
}

function stripeMode(secretKey: string, publishableKey: string): PaymentMode {
  const sample = secretKey || publishableKey;
  return sample.includes("_live_") ? "live" : "sandbox";
}

function statusFor(
  enabled: boolean,
  ready: boolean,
  mode: PaymentMode,
): ProviderStatus {
  if (!enabled) return "off";
  if (!ready) return "needs_keys";
  return mode === "live" ? "live" : "sandbox";
}

function decryptStored(key: Buffer, raw: string) {
  const envelope = JSON.parse(raw) as {
    iv: string;
    tag: string;
    data: string;
  };
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return normalizeStored(JSON.parse(json));
}

/**
 * Reads straight from Blob origin. The file is overwritten in place, so a CDN
 * read right after a save can return the previous version, and that stale copy
 * would then be held by the data cache until the next save.
 */
async function readEnvelopeFromOrigin(): Promise<EnvelopeCache> {
  const result = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return { found: false };
  }
  return { found: true, raw: await new Response(result.stream).text() };
}

/**
 * Held until an admin save calls updateTag, so origin reads stay rare.
 * A missing file throws so it is never stored without expiry.
 */
const readEnvelopeCached = unstable_cache(
  async () => {
    const entry = await readEnvelopeFromOrigin();
    if (!entry.found) throw new EnvelopeMissingError();
    return entry.raw;
  },
  ["payments-config-envelope"],
  { revalidate: false, tags: [PAYMENT_CONFIG_TAG] },
);

function rememberEnvelope(raw: string | null, ttlMs = MEMORY_TTL_MS) {
  memory = { raw, at: Date.now() - (MEMORY_TTL_MS - ttlMs) };
}

async function loadEnvelope(fresh = false): Promise<string | null> {
  try {
    let raw: string | null;
    if (fresh) {
      const entry = await readEnvelopeFromOrigin();
      raw = entry.found ? entry.raw : null;
    } else {
      raw = await readEnvelopeCached();
    }
    rememberEnvelope(raw);
    return raw;
  } catch (error) {
    if (error instanceof EnvelopeMissingError) {
      rememberEnvelope(null);
      return null;
    }
    if (memory?.raw) {
      rememberEnvelope(memory.raw, ERROR_RETRY_MS);
      return memory.raw;
    }
    rememberEnvelope(null, ERROR_RETRY_MS);
    return null;
  }
}

async function readEnvelope(fresh = false): Promise<string | null> {
  if (!blobTokenReady()) return null;
  if (!fresh && memory && Date.now() - memory.at < MEMORY_TTL_MS) return memory.raw;
  if (!fresh && inflight) return inflight;
  const task = loadEnvelope(fresh).finally(() => {
    if (inflight === task) inflight = null;
  });
  if (!fresh) inflight = task;
  return task;
}

function invalidatePaymentConfigCache() {
  try {
    updateTag(PAYMENT_CONFIG_TAG);
  } catch {
    try {
      revalidateTag(PAYMENT_CONFIG_TAG, { expire: 0 });
    } catch {
      // This instance already has the new envelope in memory.
    }
  }
}

async function readStored(fresh = false): Promise<StoredPaymentConfig | null> {
  const key = encryptionKey();
  if (!key) return null;
  const raw = await readEnvelope(fresh);
  if (!raw) return null;
  try {
    return decryptStored(key, raw);
  } catch {
    return null;
  }
}

function normalizeStored(value: Partial<StoredPaymentConfig>): StoredPaymentConfig {
  const base = emptyStored();
  return {
    stripe: { ...base.stripe, ...value.stripe },
    paypal: { ...base.paypal, ...value.paypal },
    affirm: { ...base.affirm, ...value.affirm },
    afterpay: { ...base.afterpay, ...value.afterpay },
    reign: { ...base.reign, ...value.reign },
  };
}

export async function getPaymentAccounts(options?: {
  fresh?: boolean;
}): Promise<PaymentAccounts> {
  const stored = await readStored(Boolean(options?.fresh));
  if (!stored) return { ...emptyStored(), managed: false };
  return { ...stored, managed: true };
}

export async function getAdminPaymentView(): Promise<AdminPaymentView> {
  const accounts = await getPaymentAccounts({ fresh: true });
  const stripeReady = Boolean(accounts.stripe.publishableKey && accounts.stripe.secretKey);
  const paypalReady = Boolean(accounts.paypal.clientId && accounts.paypal.clientSecret);
  const affirmReady = Boolean(accounts.affirm.publicKey && accounts.affirm.privateKey);
  const afterpayReady = Boolean(accounts.afterpay.merchantId && accounts.afterpay.secret);
  const reignReady = Boolean(
    accounts.reign.publishableKey && accounts.reign.secretKey && accounts.reign.scriptSrc,
  );
  const stripeModeValue = stripeMode(accounts.stripe.secretKey, accounts.stripe.publishableKey);
  const statuses: ProviderStatus[] = [
    statusFor(accounts.stripe.enabled, stripeReady, stripeModeValue),
    statusFor(accounts.paypal.enabled, paypalReady, accounts.paypal.mode),
    statusFor(accounts.affirm.enabled, affirmReady, accounts.affirm.mode),
    statusFor(accounts.afterpay.enabled, afterpayReady, accounts.afterpay.mode),
    statusFor(
      accounts.reign.enabled,
      reignReady,
      reignMode(accounts.reign.secretKey, accounts.reign.publishableKey),
    ),
  ];
  return {
    keyReady: paymentConfigKeyReady(),
    blobReady: blobTokenReady(),
    managed: accounts.managed,
    liveCount: statuses.filter((status) => status === "live" || status === "sandbox").length,
    stripe: {
      enabled: accounts.stripe.enabled,
      publishableKey: accounts.stripe.publishableKey,
      secretHint: maskSecret(accounts.stripe.secretKey),
      webhookHint: maskSecret(accounts.stripe.webhookSecret),
      status: statuses[0],
    },
    paypal: {
      enabled: accounts.paypal.enabled,
      mode: accounts.paypal.mode,
      clientId: accounts.paypal.clientId,
      secretHint: maskSecret(accounts.paypal.clientSecret),
      status: statuses[1],
    },
    affirm: {
      enabled: accounts.affirm.enabled,
      mode: accounts.affirm.mode,
      publicKey: accounts.affirm.publicKey,
      secretHint: maskSecret(accounts.affirm.privateKey),
      status: statuses[2],
    },
    afterpay: {
      enabled: accounts.afterpay.enabled,
      mode: accounts.afterpay.mode,
      merchantId: accounts.afterpay.merchantId,
      secretHint: maskSecret(accounts.afterpay.secret),
      mpid: accounts.afterpay.mpid,
      placementId: accounts.afterpay.placementId,
      status: statuses[3],
    },
    reign: {
      enabled: accounts.reign.enabled,
      publishableKey: accounts.reign.publishableKey,
      secretHint: maskSecret(accounts.reign.secretKey),
      webhookHint: maskSecret(accounts.reign.webhookSecret),
      scriptTag: reignScriptTag(accounts.reign.scriptSrc, accounts.reign.scriptIntegrity),
      status: statuses[4],
    },
  };
}

export function reignMode(secretKey: string, publishableKey: string): PaymentMode {
  const sample = secretKey || publishableKey;
  return sample.includes("_live_") ? "live" : "sandbox";
}

function assertPair(label: string, publishable: string, secret: string, liveMark: string) {
  if (!publishable && !secret) return;
  if (!publishable || !secret) {
    throw new Error(`${label} needs both keys.`);
  }
  const publishableLive = publishable.includes(liveMark);
  const secretLive = secret.includes(liveMark);
  if (publishableLive !== secretLive) {
    throw new Error(`${label} live and test keys are mixed.`);
  }
}

export function validatePaymentInput(input: PaymentSettingsInput, resolved: StoredPaymentConfig) {
  const stripePublishable = input.stripe.publishableKey.trim() || resolved.stripe.publishableKey;
  const stripeSecret = input.stripe.secretKey.trim() || resolved.stripe.secretKey;
  const stripeWebhook = input.stripe.webhookSecret.trim() || resolved.stripe.webhookSecret;
  if (stripePublishable && !stripePublishable.startsWith("pk_")) {
    throw new Error("Stripe publishable key must start with pk_.");
  }
  if (
    stripeSecret &&
    !stripeSecret.startsWith("sk_") &&
    !stripeSecret.startsWith("rk_")
  ) {
    throw new Error("Stripe secret key must start with sk_ or rk_.");
  }
  if (stripeWebhook && !stripeWebhook.startsWith("whsec_")) {
    throw new Error("Stripe webhook secret must start with whsec_.");
  }
  assertPair("Stripe", stripePublishable, stripeSecret, "_live_");
  const reignPublishable = input.reign.publishableKey.trim() || resolved.reign.publishableKey;
  const reignSecret = input.reign.secretKey.trim() || resolved.reign.secretKey;
  const reignWebhook = input.reign.webhookSecret.trim() || resolved.reign.webhookSecret;
  if (reignPublishable && !/^rpk_(test|live)_/.test(reignPublishable)) {
    throw new Error("Reign publishable key must start with rpk_test_ or rpk_live_.");
  }
  if (reignSecret && !/^reign_(test|live)_/.test(reignSecret)) {
    throw new Error("Reign secret key must start with reign_test_ or reign_live_.");
  }
  if (reignWebhook && !reignWebhook.startsWith("whsec_")) {
    throw new Error("Reign webhook secret must start with whsec_.");
  }
  assertPair("Reign", reignPublishable, reignSecret, "_live_");
  const reignScript = input.reign.scriptTag.trim()
    ? parseReignScriptTag(input.reign.scriptTag, reignMode(reignSecret, reignPublishable))
    : { src: "", integrity: "" };
  const mode = (value: string): PaymentMode => (value === "live" ? "live" : "sandbox");
  return {
    stripe: {
      enabled: input.stripe.enabled,
      publishableKey: stripePublishable,
      secretKey: stripeSecret,
      webhookSecret: stripeWebhook,
    },
    paypal: {
      enabled: input.paypal.enabled,
      mode: mode(input.paypal.mode),
      clientId: input.paypal.clientId.trim() || resolved.paypal.clientId,
      clientSecret: input.paypal.clientSecret.trim() || resolved.paypal.clientSecret,
    },
    affirm: {
      enabled: input.affirm.enabled,
      mode: mode(input.affirm.mode),
      publicKey: input.affirm.publicKey.trim() || resolved.affirm.publicKey,
      privateKey: input.affirm.privateKey.trim() || resolved.affirm.privateKey,
    },
    afterpay: {
      enabled: input.afterpay.enabled,
      mode: mode(input.afterpay.mode),
      merchantId: input.afterpay.merchantId.trim() || resolved.afterpay.merchantId,
      secret: input.afterpay.secret.trim() || resolved.afterpay.secret,
      mpid: resolved.afterpay.mpid,
      placementId: resolved.afterpay.placementId,
    },
    reign: {
      enabled: input.reign.enabled,
      publishableKey: reignPublishable,
      secretKey: reignSecret,
      webhookSecret: reignWebhook,
      scriptSrc: reignScript.src,
      scriptIntegrity: reignScript.integrity,
    },
  } satisfies StoredPaymentConfig;
}

export async function savePaymentSettings(input: PaymentSettingsInput) {
  const key = encryptionKey();
  if (!key) {
    throw new Error("Set PAYMENT_CONFIG_KEY before saving payment accounts.");
  }
  const current = await getPaymentAccounts({ fresh: true });
  const baseline: StoredPaymentConfig = current.managed ? current : emptyStored();
  const next = validatePaymentInput(input, baseline);
  await writeStored(next);
}

export async function clearProviderSecrets(provider: PaymentProviderId) {
  const key = encryptionKey();
  if (!key) {
    throw new Error("Set PAYMENT_CONFIG_KEY before saving payment accounts.");
  }
  const current = await getPaymentAccounts({ fresh: true });
  const next: StoredPaymentConfig = current.managed
    ? {
        stripe: { ...current.stripe },
        paypal: { ...current.paypal },
        affirm: { ...current.affirm },
        afterpay: { ...current.afterpay },
        reign: { ...current.reign },
      }
    : emptyStored();
  if (provider === "stripe") {
    next.stripe.secretKey = "";
    next.stripe.webhookSecret = "";
    next.stripe.publishableKey = "";
  } else if (provider === "paypal") {
    next.paypal.clientId = "";
    next.paypal.clientSecret = "";
  } else if (provider === "affirm") {
    next.affirm.publicKey = "";
    next.affirm.privateKey = "";
  } else if (provider === "reign") {
    next.reign = { ...emptyStored().reign, enabled: next.reign.enabled };
  } else {
    next.afterpay.merchantId = "";
    next.afterpay.secret = "";
    next.afterpay.mpid = "";
    next.afterpay.placementId = "";
  }
  await writeStored(next);
}

async function writeStored(config: StoredPaymentConfig) {
  const key = encryptionKey();
  if (!key) throw new Error("Set PAYMENT_CONFIG_KEY before saving payment accounts.");
  if (!blobTokenReady()) {
    throw new Error("Set BLOB_READ_WRITE_TOKEN before saving payment accounts.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(config), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const body = JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
  await put(BLOB_PATH, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 300,
  });
  rememberEnvelope(body);
  invalidatePaymentConfigCache();
}

export function checkoutPublicConfig(accounts: PaymentAccounts) {
  return {
    stripePublishableKey: accounts.stripe.enabled ? accounts.stripe.publishableKey : "",
    paypalClientId: accounts.paypal.enabled ? accounts.paypal.clientId : "",
    affirmPublicKey: accounts.affirm.enabled ? accounts.affirm.publicKey : "",
    affirmEnv: accounts.affirm.mode,
    afterpayMpid: accounts.afterpay.enabled ? accounts.afterpay.mpid : "",
    afterpayPlacementId: accounts.afterpay.enabled ? accounts.afterpay.placementId : "",
    reignPublishableKey: accounts.reign.enabled ? accounts.reign.publishableKey : "",
    reignScriptSrc: accounts.reign.enabled ? accounts.reign.scriptSrc : "",
    reignScriptIntegrity: accounts.reign.enabled ? accounts.reign.scriptIntegrity : "",
  };
}

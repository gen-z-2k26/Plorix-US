"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2, LogOut, Store } from "lucide-react";
import {
  clearProviderAction,
  logoutAdminAction,
  savePaymentSettingsAction,
  testProviderAction,
} from "@/app/actions/admin";
import { unwrapResult } from "@/lib/cart-result";
import { userErrorMessage } from "@/lib/user-error";
import { Button } from "@/components/ui/button";
import type {
  AdminPaymentView,
  PaymentMode,
  PaymentProviderId,
  PaymentSettingsInput,
  ProviderStatus,
} from "@/lib/payment-config";

const STATUS_LABEL: Record<ProviderStatus, string> = {
  live: "Live",
  sandbox: "Sandbox",
  off: "Off",
  needs_keys: "Needs keys",
};

const STATUS_DOT: Record<ProviderStatus, string> = {
  live: "bg-emerald-500",
  sandbox: "bg-amber-500",
  off: "bg-foreground/25",
  needs_keys: "bg-destructive",
};

export function AdminDashboard({
  storeName,
  initial,
}: {
  storeName: string;
  initial: AdminPaymentView;
}) {
  const [view, setView] = useState(initial);
  const [form, setForm] = useState<PaymentSettingsInput>(() => formFromView(initial));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tests, setTests] = useState<
    Partial<Record<PaymentProviderId, { ok: boolean; message: string }>>
  >({});
  const [pending, setPending] = useState("");

  async function save() {
    setPending("save");
    setError("");
    setMessage("");
    try {
      const next = unwrapResult(await savePaymentSettingsAction(form));
      setView(next);
      setForm(formFromView(next));
      setMessage("Payment accounts saved.");
    } catch (saveError) {
      setError(userErrorMessage(saveError, "Could not save."));
    } finally {
      setPending("");
    }
  }

  async function clearProvider(provider: PaymentProviderId) {
    setPending(provider);
    setError("");
    setMessage("");
    try {
      const next = unwrapResult(await clearProviderAction(provider));
      setView(next);
      setForm(formFromView(next));
      setMessage("Credentials cleared.");
    } catch (clearError) {
      setError(userErrorMessage(clearError, "Could not clear credentials."));
    } finally {
      setPending("");
    }
  }

  async function test(provider: PaymentProviderId) {
    setPending(`test-${provider}`);
    setError("");
    setMessage("");
    try {
      const result = await testProviderAction(provider, {
      stripe: { secretKey: form.stripe.secretKey },
      paypal: {
        mode: form.paypal.mode,
        clientId: form.paypal.clientId,
        clientSecret: form.paypal.clientSecret,
      },
      affirm: {
        mode: form.affirm.mode,
        publicKey: form.affirm.publicKey,
        privateKey: form.affirm.privateKey,
      },
      afterpay: {
        mode: form.afterpay.mode,
        merchantId: form.afterpay.merchantId,
        secret: form.afterpay.secret,
      },
      reign: { secretKey: form.reign.secretKey },
    });
      setTests((current) => ({ ...current, [provider]: result }));
    } catch (testError) {
      setTests((current) => ({
        ...current,
        [provider]: {
          ok: false,
          message: userErrorMessage(testError, "Connection failed."),
        },
      }));
    } finally {
      setPending("");
    }
  }

  const providers: { id: PaymentProviderId; name: string; status: ProviderStatus }[] = [
    { id: "stripe", name: "Stripe", status: view.stripe.status },
    { id: "paypal", name: "PayPal", status: view.paypal.status },
    { id: "affirm", name: "Affirm", status: view.affirm.status },
    { id: "afterpay", name: "Afterpay", status: view.afterpay.status },
    { id: "reign", name: "Reign", status: view.reign.status },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:h-screen lg:grid-cols-[232px_1fr] lg:overflow-hidden">
      <aside className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:h-screen lg:flex-col lg:items-stretch lg:justify-between lg:border-r lg:border-b-0 lg:px-3 lg:py-5">
        <div>
          <p className="px-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {storeName}
          </p>
          <p className="mt-1 px-2 font-display text-xl tracking-tight">Admin</p>
          <nav className="mt-4 hidden lg:block" aria-label="Admin">
            <p className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">
              <CreditCard className="size-4" aria-hidden />
              Payments
            </p>
          </nav>
        </div>
        <div className="flex items-center gap-1 lg:flex-col lg:items-stretch">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Store className="size-4" aria-hidden />
            Store
          </Link>
          <form action={logoutAdminAction}>
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 lg:h-screen lg:overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-5 py-3 backdrop-blur md:px-8">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Payments</h1>
            <p className="text-sm text-muted-foreground">
              {view.liveCount} of {providers.length} ready at checkout
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending !== "" || !view.keyReady || !view.blobReady}
            onClick={() => void save()}
          >
            {pending === "save" ? "Saving..." : "Save changes"}
          </Button>
        </header>

        <main className="mx-auto max-w-4xl space-y-6 px-5 py-6 md:px-8 md:py-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {providers.map((provider) => (
              <a
                key={provider.id}
                href={`#${provider.id}`}
                className="rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/20"
              >
                <GatewayMark id={provider.id} />
                <span className="mt-3 flex items-center gap-2 text-sm font-medium">
                  <span className={`size-1.5 rounded-full ${STATUS_DOT[provider.status]}`} />
                  {provider.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {STATUS_LABEL[provider.status]}
                </span>
              </a>
            ))}
          </section>

          {!view.keyReady || !view.blobReady ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {!view.keyReady
                ? "Set PAYMENT_CONFIG_KEY to a 32-byte base64 value before saving accounts."
                : "Set BLOB_READ_WRITE_TOKEN before saving accounts."}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">{message}</p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Turn a method on to show it at checkout. Leave a secret blank to keep the saved one. Secrets never return to this page.
          </p>

          <div className="space-y-4">
            <ProviderCard
              id="stripe"
              title="Stripe"
              detail="Publishable key and secret or restricted key"
              status={view.stripe.status}
              enabled={form.stripe.enabled}
              onEnabled={(enabled) =>
                setForm((current) => ({ ...current, stripe: { ...current.stripe, enabled } }))
              }
            >
              <Field
                id="stripe-pk"
                label="Publishable key"
                value={form.stripe.publishableKey}
                mono
                onChange={(publishableKey) =>
                  setForm((current) => ({ ...current, stripe: { ...current.stripe, publishableKey } }))
                }
              />
              <SecretField
                id="stripe-sk"
                label="Secret or restricted key"
                hint={view.stripe.secretHint}
                value={form.stripe.secretKey}
                onChange={(secretKey) =>
                  setForm((current) => ({ ...current, stripe: { ...current.stripe, secretKey } }))
                }
              />
              <SecretField
                id="stripe-wh"
                label="Webhook signing secret"
                hint={view.stripe.webhookHint}
                value={form.stripe.webhookSecret}
                onChange={(webhookSecret) =>
                  setForm((current) => ({ ...current, stripe: { ...current.stripe, webhookSecret } }))
                }
              />
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                The card form uses the publishable and secret keys. The webhook secret only checks that payment events came from Stripe.
              </p>
              <CardActions
                pending={pending}
                provider="stripe"
                onClear={() => void clearProvider("stripe")}
                onTest={() => void test("stripe")}
                result={tests.stripe}
              />
            </ProviderCard>

            <ProviderCard
              id="paypal"
              title="PayPal"
              detail="Client ID and client secret"
              status={view.paypal.status}
              enabled={form.paypal.enabled}
              onEnabled={(enabled) =>
                setForm((current) => ({ ...current, paypal: { ...current.paypal, enabled } }))
              }
              mode={form.paypal.mode}
              onMode={(mode) =>
                setForm((current) => ({ ...current, paypal: { ...current.paypal, mode } }))
              }
            >
              <Field
                id="paypal-id"
                label="Client ID"
                value={form.paypal.clientId}
                mono
                onChange={(clientId) =>
                  setForm((current) => ({ ...current, paypal: { ...current.paypal, clientId } }))
                }
              />
              <SecretField
                id="paypal-secret"
                label="Client secret"
                hint={view.paypal.secretHint}
                value={form.paypal.clientSecret}
                onChange={(clientSecret) =>
                  setForm((current) => ({ ...current, paypal: { ...current.paypal, clientSecret } }))
                }
              />
              <CardActions
                pending={pending}
                provider="paypal"
                onClear={() => void clearProvider("paypal")}
                onTest={() => void test("paypal")}
                result={tests.paypal}
              />
            </ProviderCard>

            <ProviderCard
              id="affirm"
              title="Affirm"
              detail="Public key and private key"
              status={view.affirm.status}
              enabled={form.affirm.enabled}
              onEnabled={(enabled) =>
                setForm((current) => ({ ...current, affirm: { ...current.affirm, enabled } }))
              }
              mode={form.affirm.mode}
              onMode={(mode) =>
                setForm((current) => ({ ...current, affirm: { ...current.affirm, mode } }))
              }
            >
              <Field
                id="affirm-public"
                label="Public API key"
                value={form.affirm.publicKey}
                mono
                onChange={(publicKey) =>
                  setForm((current) => ({ ...current, affirm: { ...current.affirm, publicKey } }))
                }
              />
              <SecretField
                id="affirm-private"
                label="Private API key"
                hint={view.affirm.secretHint}
                value={form.affirm.privateKey}
                onChange={(privateKey) =>
                  setForm((current) => ({ ...current, affirm: { ...current.affirm, privateKey } }))
                }
              />
              <CardActions
                pending={pending}
                provider="affirm"
                onClear={() => void clearProvider("affirm")}
                onTest={() => void test("affirm")}
                result={tests.affirm}
              />
            </ProviderCard>

            <ProviderCard
              id="afterpay"
              title="Afterpay"
              detail="Merchant ID and secret key"
              status={view.afterpay.status}
              enabled={form.afterpay.enabled}
              onEnabled={(enabled) =>
                setForm((current) => ({
                  ...current,
                  afterpay: { ...current.afterpay, enabled },
                }))
              }
              mode={form.afterpay.mode}
              onMode={(mode) =>
                setForm((current) => ({ ...current, afterpay: { ...current.afterpay, mode } }))
              }
            >
              <Field
                id="afterpay-merchant"
                label="Merchant ID"
                value={form.afterpay.merchantId}
                mono
                onChange={(merchantId) =>
                  setForm((current) => ({ ...current, afterpay: { ...current.afterpay, merchantId } }))
                }
              />
              <SecretField
                id="afterpay-secret"
                label="Secret key"
                hint={view.afterpay.secretHint}
                value={form.afterpay.secret}
                onChange={(secret) =>
                  setForm((current) => ({ ...current, afterpay: { ...current.afterpay, secret } }))
                }
              />
              <CardActions
                pending={pending}
                provider="afterpay"
                onClear={() => void clearProvider("afterpay")}
                onTest={() => void test("afterpay")}
                result={tests.afterpay}
              />
            </ProviderCard>

            <ProviderCard
              id="reign"
              title="Reign"
              detail="Payments API publishable key, secret key and Reign.js tag. USD only."
              status={view.reign.status}
              enabled={form.reign.enabled}
              onEnabled={(enabled) =>
                setForm((current) => ({ ...current, reign: { ...current.reign, enabled } }))
              }
            >
              <Field
                id="reign-pk"
                label="Publishable key"
                value={form.reign.publishableKey}
                mono
                onChange={(publishableKey) =>
                  setForm((current) => ({ ...current, reign: { ...current.reign, publishableKey } }))
                }
              />
              <SecretField
                id="reign-sk"
                label="Secret key"
                hint={view.reign.secretHint}
                value={form.reign.secretKey}
                onChange={(secretKey) =>
                  setForm((current) => ({ ...current, reign: { ...current.reign, secretKey } }))
                }
              />
              <SecretField
                id="reign-wh"
                label="Webhook signing secret (optional)"
                hint={view.reign.webhookHint}
                value={form.reign.webhookSecret}
                onChange={(webhookSecret) =>
                  setForm((current) => ({ ...current, reign: { ...current.reign, webhookSecret } }))
                }
              />
              <label className="block space-y-1.5 sm:col-span-2" htmlFor="reign-script">
                <span className="text-xs font-medium text-muted-foreground">
                  Reign.js script tag
                </span>
                <textarea
                  id="reign-script"
                  rows={3}
                  value={form.reign.scriptTag}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder='<script src="https://js.reign-sandbox.com/payments/..." integrity="sha384-..." crossorigin="anonymous"></script>'
                  onChange={(event) => {
                    const scriptTag = event.target.value;
                    setForm((current) => ({ ...current, reign: { ...current.reign, scriptTag } }));
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12px] outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                Create these under Developers, Payments API in the Reign portal, and add this site as an allowed origin. Test keys start with reign_test_ and rpk_test_. The webhook secret is only needed if you add {"/api/reign/webhook"} as an endpoint.
              </p>
              <CardActions
                pending={pending}
                provider="reign"
                onClear={() => void clearProvider("reign")}
                onTest={() => void test("reign")}
                result={tests.reign}
              />
            </ProviderCard>
          </div>
        </main>
      </div>
    </div>
  );
}

function formFromView(view: AdminPaymentView): PaymentSettingsInput {
  return {
    stripe: {
      enabled: view.stripe.enabled,
      publishableKey: view.stripe.publishableKey,
      secretKey: "",
      webhookSecret: "",
    },
    paypal: {
      enabled: view.paypal.enabled,
      mode: view.paypal.mode,
      clientId: view.paypal.clientId,
      clientSecret: "",
    },
    affirm: {
      enabled: view.affirm.enabled,
      mode: view.affirm.mode,
      publicKey: view.affirm.publicKey,
      privateKey: "",
    },
    afterpay: {
      enabled: view.afterpay.enabled,
      mode: view.afterpay.mode,
      merchantId: view.afterpay.merchantId,
      secret: "",
    },
    reign: {
      enabled: view.reign.enabled,
      publishableKey: view.reign.publishableKey,
      secretKey: "",
      webhookSecret: "",
      scriptTag: view.reign.scriptTag,
    },
  };
}

const GATEWAY_MARK: Record<PaymentProviderId, string> = {
  stripe: "/payments/stripe.svg",
  paypal: "/payments/paypal.svg",
  affirm: "/payments/affirm.svg",
  afterpay: "/payments/afterpay.svg",
  reign: "/payments/reign.svg",
};

function GatewayMark({ id }: { id: PaymentProviderId }) {
  return (
    <span className="inline-flex h-9 items-center rounded-md bg-white px-2 ring-1 ring-black/10 dark:ring-white/15">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={GATEWAY_MARK[id]}
        alt=""
        className="h-5 w-auto max-w-[4.5rem] object-contain object-left"
      />
    </span>
  );
}

function ProviderCard({
  id,
  title,
  detail,
  status,
  enabled,
  onEnabled,
  mode,
  onMode,
  children,
}: {
  id: PaymentProviderId;
  title: string;
  detail: string;
  status: ProviderStatus;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  mode?: PaymentMode;
  onMode?: (mode: PaymentMode) => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
        <GatewayMark id={id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex items-center gap-2">
          {onMode && mode ? <ModeSwitch mode={mode} onMode={onMode} /> : null}
          <Switch on={enabled} label={`${title} enabled`} onChange={onEnabled} />
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ModeSwitch({
  mode,
  onMode,
}: {
  mode: PaymentMode;
  onMode: (mode: PaymentMode) => void;
}) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium">
      {(["sandbox", "live"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onMode(option)}
          className={`rounded-md px-2.5 py-1 ${mode === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          {option === "sandbox" ? "Sandbox" : "Live"}
        </button>
      ))}
    </div>
  );
}

function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full border border-border bg-background py-1 pr-1 pl-3.5"
    >
      <span className={`w-6 text-left text-[11px] font-semibold tracking-[0.08em] uppercase ${on ? "text-foreground" : "text-muted-foreground"}`}>
        {on ? "On" : "Off"}
      </span>
      <span
        className={`relative h-7 w-12 rounded-full ${on ? "bg-foreground" : "bg-muted"}`}
      >
        <span
          className="absolute top-[3px] left-[3px] size-[22px] rounded-full bg-background shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground";

function Field({
  id,
  label,
  value,
  onChange,
  mono = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        id={id}
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} ${mono ? "font-mono text-[13px]" : ""}`}
      />
    </label>
  );
}

function SecretField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        <span className="font-normal">{hint ? "Saved" : "Not set"}</span>
      </span>
      <input
        id={id}
        type="password"
        value={value}
        autoComplete="new-password"
        placeholder={hint || "Paste a new key"}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} font-mono text-[13px]`}
      />
    </label>
  );
}

function CardActions({
  pending,
  provider,
  onClear,
  onTest,
  result,
}: {
  pending: string;
  provider: PaymentProviderId;
  onClear: () => void;
  onTest: () => void;
  result?: { ok: boolean; message: string };
}) {
  const testing = pending === `test-${provider}`;
  return (
    <div className="space-y-2 border-t border-border pt-4 sm:col-span-2">
      <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending !== ""} onClick={onTest}>
        {testing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {testing ? "Testing..." : "Test connection"}
      </Button>
      <button
        type="button"
        disabled={pending !== ""}
        onClick={onClear}
        className="h-9 px-3 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {pending === provider ? "Clearing..." : "Clear credentials"}
      </button>
      </div>
      {result ? (
        <p
          className={`text-sm ${result.ok ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

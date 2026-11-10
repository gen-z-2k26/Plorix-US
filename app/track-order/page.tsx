import { Suspense } from "react";
import type { Metadata } from "next";
import { Mail, Package, Truck } from "lucide-react";
import { TrackOrderForm } from "@/components/TrackOrderForm";
import { getSiteSettings } from "@/lib/api";
import { pageContainer } from "@/lib/layout";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Look up a guest order with your order number, order key, and billing email.",
};

const steps = [
  {
    icon: Mail,
    title: "Open the email",
    text: "The confirmation has the order number, order key, and billing email.",
  },
  {
    icon: Package,
    title: "Match the details",
    text: "Use the same email you entered at checkout. The key starts with wc_order_.",
  },
  {
    icon: Truck,
    title: "See the status",
    text: "Paid orders stay in processing until the carrier picks them up.",
  },
];

export default async function TrackOrderPage() {
  const settings = await getSiteSettings();

  return (
    <div className="pb-16">
      <section className="dark relative overflow-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,56,248,0.35),transparent_52%)]"
        />
        <div className={pageContainer("relative py-14 sm:py-20")}>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {settings.name}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl text-white sm:text-6xl">
            Track your order
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-white/80">
            Look up a guest order with the number, key, and email from your confirmation.
            Phone support is {settings.contact.openingHours}. Live chat is available 24/7.
          </p>
        </div>
      </section>

      <div className={pageContainer("space-y-8 bg-background py-10 sm:py-14")}>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <step.icon className="size-4" aria-hidden />
                {step.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <Suspense
          fallback={
            <div className="h-64 rounded-2xl border border-border bg-card" />
          }
        >
          <TrackOrderForm />
        </Suspense>

        {settings.contact.email || settings.contact.phone ? (
          <p className="text-sm text-foreground/80">
            Still stuck?{" "}
            {settings.contact.email ? (
              <a
                className="font-semibold text-foreground underline underline-offset-2"
                href={`mailto:${settings.contact.email}`}
              >
                {settings.contact.email}
              </a>
            ) : null}
            {settings.contact.email && settings.contact.phone ? " or " : null}
            {settings.contact.phone ? (
              <span className="font-semibold text-foreground">{settings.contact.phone}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

import type { StoreSettings } from "@/lib/types";
import { pageContainer, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";

export function SupportSection({ settings }: { settings: StoreSettings }) {
  const phoneHref = settings.contact.phone.replace(/[^\d+]/g, "");
  const facts = [
    { label: "Email", value: settings.contact.email, href: `mailto:${settings.contact.email}` },
    { label: "Phone", value: settings.contact.phone, href: `tel:${phoneHref}` },
    { label: "Hours", value: settings.contact.openingHours },
    { label: "Live chat", value: settings.footer?.chatLine || "24/7 Live Chat" },
  ];

  return (
    <section
      aria-labelledby="support-heading"
      className={cn("border-b border-border", sectionYClass)}
    >
      <div className={pageContainer()}>
        <div className="dark rounded-lg bg-background px-6 py-10 text-foreground sm:px-10">
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            Customer support
          </p>
          <h2
            id="support-heading"
            className="font-display mt-3 max-w-xl text-3xl text-balance sm:text-4xl"
          >
            Phone on weekdays. Live chat any time.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
            {settings.contact.address}
          </p>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs tracking-[0.14em] text-white/50 uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-2 text-sm">
                  {fact.href && fact.value ? (
                    <a href={fact.href} className="hover:text-accent">
                      {fact.value}
                    </a>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import type { StoreSettings } from "@/lib/types";
import { BrandLogo } from "@/components/BrandLogo";
import { pageContainer } from "@/lib/layout";

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

export function Footer({ settings }: { settings: StoreSettings }) {
  const columns =
    settings.navigation?.footerColumns?.length > 0
      ? settings.navigation.footerColumns
      : [];
  const phoneHref = settings.contact.phone.replace(/[^\d+]/g, "");
  const year = new Date().getFullYear();

  return (
    <footer className="dark mt-auto bg-background text-foreground">
      <div className={pageContainer("py-12 sm:py-16")}>
        <Link href="/" className="inline-flex items-center">
          <BrandLogo heightClass="h-8 sm:h-9" alt={settings.name} />
        </Link>

        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column) => (
            <div key={column.slug || column.title} className="space-y-3">
              <p className="text-sm font-medium tracking-tight text-white">
                {column.title}
              </p>
              <ul className="space-y-2.5 text-sm text-white/70">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    {isExternal(link.href) ? (
                      <a
                        href={link.href}
                        className="transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/15 pt-6">
          <p className="text-sm font-medium text-white">
            {settings.footer?.contactTitle || "Customer Support"}
          </p>
          <p className="mt-2 text-sm text-white/75">
            {settings.contact.email ? (
              <a
                href={`mailto:${settings.contact.email}`}
                className="hover:text-accent"
              >
                {settings.contact.email}
              </a>
            ) : null}
            {settings.contact.email && settings.contact.phone ? (
              <span className="px-2 text-white/40">|</span>
            ) : null}
            {settings.contact.phone ? (
              <a href={`tel:${phoneHref}`} className="hover:text-accent">
                {settings.contact.phone}
              </a>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-white/75">
            {settings.contact.openingHours}
            {settings.contact.openingHours && settings.footer?.chatLine ? (
              <span className="px-2 text-white/40">|</span>
            ) : null}
            {settings.footer?.chatLine}
          </p>
        </div>

        <div className="mt-6 border-t border-white/15 pt-6 text-xs text-white/60">
          <p>
            © {year} {settings.name}. Operated by{" "}
            {settings.contact.legalName || settings.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

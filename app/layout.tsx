import type { Metadata } from "next";
import Script from "next/script";
import { Figtree, Syne } from "next/font/google";
import { ChatbotGate } from "@/components/ChatbotGate";
import { JsonLd } from "@/components/JsonLd";
import { SiteChrome } from "@/components/SiteChrome";
import { StoreProvider } from "@/lib/store-context";
import { ThemeModeProvider } from "@/lib/theme-mode";
import { getSiteSettings, getSiteUrl } from "@/lib/api";
import { getThemeStyle } from "@/lib/theme";
import { defaultPages } from "@/lib/types";
import { themeInitScript } from "@/lib/theme-script";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-syne",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSiteSettings();
    const siteUrl = getSiteUrl(settings);
    const title =
      settings.seo.title || `${settings.name} | Online store`;
    const description =
      settings.seo.description ||
      `Shop ${settings.name}. ${settings.tagline}`;
    const ogImage = settings.seo.ogImage || settings.logo;

    return {
      metadataBase: siteUrl ? new URL(siteUrl) : undefined,
      title: {
        default: title,
        template: `%s | ${settings.name}`,
      },
      description,
      applicationName: settings.name,
      authors: [{ name: settings.name }],
      creator: settings.name,
      keywords: settings.seo.keywords.length
        ? settings.seo.keywords
        : [settings.name, "electronics", "computer components"],
      openGraph: {
        type: "website",
        siteName: settings.name,
        title,
        description,
        url: siteUrl || "/",
        images: [
          {
            url: ogImage,
            alt: `${settings.name} logo`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: "/",
      },
    };
  } catch {
    return {
      title: "Online store",
      description: "Simple ecommerce storefront.",
      robots: {
        index: true,
        follow: true,
      },
    };
  }
}

function postalAddressLd(address: string) {
  const trimmed = address.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const streetAddress = parts[0] || trimmed;
  const locality = parts[1] || "";
  const regionPostal = parts[2] || "";
  const [region, ...postalParts] = regionPostal.split(/\s+/);
  const postalCode = postalParts.join(" ");
  const countryPart = (parts[3] || parts.at(-1) || "").toUpperCase();
  const addressCountry =
    countryPart === "USA" || countryPart === "UNITED STATES" || countryPart === "US"
      ? "US"
      : countryPart.length === 2
        ? countryPart
        : "US";

  return {
    "@type": "PostalAddress",
    streetAddress,
    addressLocality: locality || undefined,
    addressRegion: region || undefined,
    postalCode: postalCode || undefined,
    addressCountry,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const siteUrl = getSiteUrl(settings);
  const absolute = (path: string) =>
    siteUrl ? `${siteUrl}${path.startsWith("/") ? path : `/${path}`}` : path;

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.name,
    legalName: settings.contact.legalName || settings.name,
    logo: absolute(settings.logo),
    url: absolute("/"),
    email: settings.contact.email,
    telephone: settings.contact.phone,
    address: postalAddressLd(settings.contact.address),
    vatID: settings.contact.vatNumber || undefined,
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.name,
    url: absolute("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: absolute("/products?q={search_term_string}"),
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html
      lang={settings.locale.startsWith("nl") ? "nl" : "en"}
      className={`${figtree.variable} ${syne.variable} antialiased`}
      style={getThemeStyle(settings)}
      data-store={settings.id}
      data-motion={settings.theme.motion}
      suppressHydrationWarning
    >
      <head>
        {settings.theme.fontUrl ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
            <link
              rel="stylesheet"
              href={settings.theme.fontUrl}
              precedence="default"
            />
          </>
        ) : null}
      </head>
      <body
        className="flex min-h-full flex-col bg-background font-sans text-foreground"
        suppressHydrationWarning
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <JsonLd data={organizationLd} />
        <JsonLd data={websiteLd} />
        <ThemeModeProvider defaultMode={settings.theme.defaultMode}>
          <StoreProvider settings={{ ...settings, pages: defaultPages }}>
            <SiteChrome settings={{ ...settings, pages: defaultPages }}>
              {children}
            </SiteChrome>
          </StoreProvider>
        </ThemeModeProvider>
        <ChatbotGate />
      </body>
    </html>
  );
}

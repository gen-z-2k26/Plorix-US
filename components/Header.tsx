"use client";

import Link from "next/link";
import { Menu, ShoppingBag, Star, X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PromoBanner } from "@/components/PromoBanner";
import { useCartStore } from "@/lib/cart-store";
import { useStore } from "@/lib/store-context";
import { useMotionEnabled } from "@/lib/use-motion-enabled";
import { BrandLogo } from "@/components/BrandLogo";
import { ReviewStars } from "@/components/ReviewStars";
import { pageContainer } from "@/lib/layout";
import { storeReviewSummary } from "@/lib/store-reviews";
import { cn } from "@/lib/utils";

const fallbackNav = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/about-us", label: "About" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact-us", label: "Contact" },
];

function HeaderReviewsLink({
  onNavigate,
  className,
  compact = false,
}: {
  onNavigate?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const { average, total } = storeReviewSummary();
  const score = average.toFixed(1);

  return (
    <Link
      href="/reviews"
      onClick={onNavigate}
      aria-label={`${score} out of 5 from ${total} Plorix reviews across the United States. Read all reviews`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
        className,
      )}
    >
      {compact ? (
        <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      ) : (
        <ReviewStars rating={average} size="sm" decorative />
      )}
      <span className="font-medium text-foreground tabular-nums">{score}</span>
      <span className="tabular-nums">{compact ? total : `${total} reviews`}</span>
    </Link>
  );
}

export function Header() {
  const { settings } = useStore();
  const items = useCartStore((state) => state.cart.items);
  const openCart = useCartStore((state) => state.openCart);
  const badgeBump = useCartStore((state) => state.badgeBump);
  const { enabled } = useMotionEnabled();
  const [bump, setBump] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const navLinks =
    settings.navigation?.header?.length > 0
      ? settings.navigation.header
      : fallbackNav;

  useEffect(() => {
    if (!badgeBump || !enabled) return;
    setBump(true);
    const timer = window.setTimeout(() => setBump(false), 180);
    return () => window.clearTimeout(timer);
  }, [badgeBump, enabled]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl supports-backdrop-filter:bg-background/75">
      <PromoBanner />

      <div className={pageContainer("flex h-14 items-center gap-1.5 sm:h-16 sm:gap-3 lg:gap-8")}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>

        <Link
          href="/"
          className="inline-flex min-w-0 shrink items-center rounded-xl transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo
            heightClass="h-6 sm:h-8"
            className="max-w-[7.25rem] sm:max-w-none"
          />
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-0 text-sm lg:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground xl:px-3"
            >
              {link.label}
            </Link>
          ))}
          <HeaderReviewsLink className="ml-1" />
        </nav>

        <div
          data-header-chrome
          className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2"
        >
          <HeaderReviewsLink compact className="px-1.5 lg:hidden" />

          <Suspense
            fallback={
              <div className="size-10 rounded-xl border border-border bg-background" />
            }
          >
            <SearchBar />
          </Suspense>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative"
            aria-label={`Open cart${count ? `, ${count} items` : ""}`}
            onClick={openCart}
          >
            <ShoppingBag className="size-4" />
            {count > 0 ? (
              <Badge
                className={cn(
                  "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary px-0 text-[10px] text-primary-foreground tabular-nums shadow-xs",
                  enabled && "transition-transform duration-150",
                  bump && "scale-125",
                )}
              >
                {count}
              </Badge>
            ) : null}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-border bg-card/95 px-4 py-4 backdrop-blur-lg sm:px-6 lg:hidden lg:px-8">
          <nav
            aria-label="Mobile"
            className="flex flex-col gap-1 text-sm"
          >
            {navLinks.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <HeaderReviewsLink
              onNavigate={() => setMenuOpen(false)}
              className="mt-1 justify-start px-3 py-2.5"
            />
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border px-3 pt-3 sm:hidden">
            <span className="text-sm text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </header>
  );
}

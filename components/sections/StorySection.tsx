import Image from "next/image";
import Link from "next/link";
import type { StoreSettings } from "@/lib/types";
import { Reveal, RevealImage } from "@/components/sections/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { pageContainer, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";

export function StorySection({ settings }: { settings: StoreSettings }) {
  return (
    <section
      aria-labelledby="story-heading"
      className={cn("border-b border-border", sectionYClass)}
    >
      <div
        className={pageContainer(
          "grid items-center gap-8 lg:grid-cols-2 lg:gap-14",
        )}
      >
        <RevealImage className="dark relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-background p-10">
          <Image
            src="/brand/plorix-logo-white.png"
            alt="Plorix"
            width={640}
            height={140}
            className="h-auto w-full max-w-md object-contain"
          />
        </RevealImage>

        <Reveal className="space-y-5">
          <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
            About {settings.name}
          </p>
          <h2
            id="story-heading"
            className="font-display text-balance text-3xl sm:text-4xl"
          >
            Technology shopping, made straightforward
          </h2>
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground">
            {settings.name} is a U.S. online shop for electronics, computer
            components, gaming equipment, and technology accessories, operated
            by {settings.contact.legalName} in Anchorage, Alaska.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>Product details, prices, and shipping charges shown before checkout.</li>
            <li>Order updates and tracking when a shipment is created.</li>
            <li>
              Customer care at {settings.contact.email} or {settings.contact.phone}.
            </li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/about-us" className={cn(buttonVariants({ size: "lg" }))}>
              About us
            </Link>
            <Link
              href="/our-commitment"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Our commitment
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

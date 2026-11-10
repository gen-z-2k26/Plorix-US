"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import type { StoreSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageContainer, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-store";

export function NewsletterSection({ settings }: { settings: StoreSettings }) {
  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-heading"
      className={cn(sectionYClass)}
    >
      <div className={pageContainer()}>
        <div className="grid overflow-hidden rounded-3xl bg-card lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="dark relative min-h-56 bg-background sm:min-h-72">
            <Image
              src="/brand/footer-image.jpg"
              alt="Plorix"
              fill
              sizes="(min-width: 1024px) 36vw, 100vw"
              className="object-contain"
            />
          </div>
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:py-14">
            <p className="text-sm font-medium tracking-[0.16em] text-accent uppercase">
              {settings.name}
            </p>
            <h2
              id="newsletter-heading"
              className="font-display mt-3 text-balance text-3xl sm:text-4xl"
            >
              Stay in the loop
            </h2>
            <p className="mt-3 max-w-md text-pretty text-muted-foreground">
              Get updates on new arrivals and offers from {settings.name}.
            </p>
            <form
              className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
              action={`mailto:${settings.contact.email}`}
              method="get"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                const form = event.currentTarget;
                const email = new FormData(form).get("body");
                if (typeof email === "string" && email.trim()) {
                  toast({
                    title: "Opening your email app",
                    description: "Finish sending to subscribe.",
                  });
                }
              }}
            >
              <Input
                type="email"
                name="body"
                required
                placeholder="Your email address"
                className="h-12 bg-background"
                aria-label="Email address for newsletter"
              />
              <Button type="submit" size="lg" className="sm:px-6">
                Subscribe
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              You can unsubscribe anytime via {settings.contact.email}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

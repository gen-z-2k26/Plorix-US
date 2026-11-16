import type { ReactNode } from "react";
import { IntentLink as Link } from "@/components/IntentLink";
import { ContactForm } from "@/components/ContactForm";
import {
  BlockView,
  CustomerCareShell,
  RichText,
} from "@/components/CustomerCarePage";
import type { CareBlock, CarePage, CareSection } from "@/lib/customer-care";
import type { StoreSettings } from "@/lib/types";
import { pageContainer } from "@/lib/layout";
import { cn } from "@/lib/utils";

function copyrightFrom(page: CarePage) {
  return page.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.type === "paragraph" && block.text.startsWith("©"));
}

function withoutCopyright(blocks: CareBlock[]) {
  return blocks.filter(
    (block) => !(block.type === "paragraph" && block.text.startsWith("©")),
  );
}

function SectionBody({
  section,
  contactStyle = "card",
  numbered,
  index,
}: {
  section: CareSection;
  contactStyle?: "card" | "grid" | "panel";
  numbered?: boolean;
  index?: number;
}) {
  const blocks = withoutCopyright(section.blocks);
  return (
    <section
      id={section.id}
      className="scroll-mt-24 mb-10 border-b border-border pb-10 last:mb-0 last:border-b-0 last:pb-0"
    >
      <h2 className="font-display mb-4 text-[27px] leading-tight font-normal tracking-[-0.025em]">
        {numbered ? (
          <span className="flex gap-4">
            <span className="text-primary/80 tabular-nums">
              {String((index ?? 0) + 1).padStart(2, "0")}
            </span>
            <span>{section.title.replace(/^\d+\.\s+/, "")}</span>
          </span>
        ) : (
          section.title
        )}
      </h2>
      {blocks.map((block, blockIndex) => (
        <BlockView
          key={`${section.id}-${blockIndex}`}
          block={block}
          contactStyle={contactStyle}
        />
      ))}
    </section>
  );
}

function FooterNote({ page }: { page: CarePage }) {
  const copy = copyrightFrom(page);
  if (!copy || copy.type !== "paragraph") return null;
  return (
    <p className="mt-14 border-t border-border pt-5 text-[11px] text-muted-foreground">
      {copy.text}
    </p>
  );
}

export function DiscoverAbout({
  page,
  settings,
}: {
  page: CarePage;
  settings: StoreSettings;
}) {
  return (
    <div className="pb-16">
      <section className="bg-foreground text-background">
        <div className={pageContainer("py-14 sm:py-20")}>
          <p className="text-xs font-semibold tracking-[0.22em] text-background/70 uppercase">
            About {settings.name}
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[1.05] text-background sm:text-6xl">
            {page.tagline || page.title}
          </h1>
          <div className="mt-6 max-w-2xl space-y-4 text-base leading-7 text-background/90">
            {page.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>
                <RichText text={paragraph} />
              </p>
            ))}
          </div>
        </div>
      </section>

      <div className={pageContainer("space-y-5 pt-8 sm:pt-10")}>
        {page.sections.map((section, index) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-24 rounded-2xl border border-foreground/15 bg-card p-6 sm:p-8"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-4 font-display text-3xl text-foreground">
              {section.title}
            </h2>
            <div className="mt-4">
              {withoutCopyright(section.blocks).map((block, blockIndex) => (
                <BlockView
                  key={`${section.id}-${blockIndex}`}
                  block={block}
                  contactStyle="grid"
                  tone="strong"
                />
              ))}
            </div>
          </section>
        ))}
        <FooterNote page={page} />
      </div>
    </div>
  );
}

export function DiscoverContact({
  page,
  settings,
}: {
  page: CarePage;
  settings: StoreSettings;
}) {
  const getInTouch = page.sections.find((section) => section.id === "get-in-touch");
  const rest = page.sections.filter((section) => section.id !== "get-in-touch");
  const send = rest.find((section) => section.id === "send-us-a-message");
  const other = rest.filter((section) => section.id !== "send-us-a-message");

  const channels: Array<{ title: string; blocks: CareBlock[] }> = [];
  if (getInTouch) {
    let current: { title: string; blocks: CareBlock[] } | null = null;
    for (const block of getInTouch.blocks) {
      if (block.type === "heading") {
        current = { title: block.text, blocks: [] };
        channels.push(current);
      } else if (current) {
        current.blocks.push(block);
      } else {
        channels.push({ title: getInTouch.title, blocks: [block] });
      }
    }
  }

  return (
    <CustomerCareShell
      settings={settings}
      title={page.title}
      eyebrow={page.tagline || "We're Here to Help"}
      intro={page.intro.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>
          <RichText text={paragraph} />
        </p>
      ))}
    >
      {channels.length ? (
        <div className="mb-14">
          <h2 className="font-display mb-6 text-[27px]">{getInTouch?.title}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {channels.map((channel, index) => (
              <div
                key={channel.title}
                className="rounded-[3px] border border-border p-6"
              >
                <p className="mb-3 text-[10px] font-bold tracking-[0.16em] text-primary uppercase">
                  {String(index + 1).padStart(2, "0")} / {channel.title}
                </p>
                {channel.blocks.map((block, blockIndex) => (
                  <BlockView
                    key={`${channel.title}-${blockIndex}`}
                    block={block}
                    contactStyle="grid"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {other.map((section) => (
        <SectionBody
          key={section.id}
          section={section}
          contactStyle="grid"
        />
      ))}

      {send ? (
        <section id={send.id} className="mt-10 scroll-mt-24">
          <h2 className="font-display mb-3 text-[27px]">{send.title}</h2>
          {withoutCopyright(send.blocks).map((block, index) => (
            <BlockView key={index} block={block} contactStyle="grid" />
          ))}
          <div className="mt-6 rounded-[3px] border border-border bg-card p-6 sm:p-8">
            <ContactForm />
          </div>
        </section>
      ) : (
        <div className="mt-10 rounded-[3px] border border-border bg-card p-6 sm:p-8">
          <ContactForm />
        </div>
      )}
      <FooterNote page={page} />
    </CustomerCareShell>
  );
}

export function DiscoverCommitment({
  page,
  settings,
}: {
  page: CarePage;
  settings: StoreSettings;
}) {
  return (
    <CustomerCareShell
      settings={settings}
      title={page.tagline || page.title}
      eyebrow="Our Commitment"
      intro={page.intro.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>
          <RichText text={paragraph} />
        </p>
      ))}
    >
      {page.sections.map((section, index) => (
        <SectionBody
          key={section.id}
          section={section}
          numbered
          index={index}
          contactStyle="grid"
        />
      ))}
      <FooterNote page={page} />
    </CustomerCareShell>
  );
}

export function DiscoverFaqFrame({
  page,
  settings,
  children,
}: {
  page: CarePage;
  settings: StoreSettings;
  children: ReactNode;
}) {
  return (
    <CustomerCareShell
      settings={settings}
      title={page.title}
      eyebrow={page.tagline}
      intro={page.intro
        .filter((paragraph) => !paragraph.startsWith("Email:") && !paragraph.startsWith("Phone:") && !paragraph.startsWith("Live Chat:"))
        .map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>
            <RichText text={paragraph} />
          </p>
        ))}
    >
      {page.intro.some((paragraph) => paragraph.startsWith("Email:")) ? (
        <p className="mb-10 text-sm text-muted-foreground">
          {page.intro
            .filter((paragraph) =>
              paragraph.startsWith("Email:") ||
              paragraph.startsWith("Phone:") ||
              paragraph.startsWith("Live Chat:"),
            )
            .map((paragraph) => (
              <span key={paragraph} className="mr-6 inline-block">
                <RichText text={paragraph} />
              </span>
            ))}
        </p>
      ) : null}
      {children}
      <p className="mt-14">
        <Link href="/contact-us" className="text-sm underline underline-offset-4">
          Contact Customer Support
        </Link>
      </p>
      <FooterNote page={page} />
    </CustomerCareShell>
  );
}

export function sectionClassName(last?: boolean) {
  return cn(
    "scroll-mt-24 mb-10 border-b border-border pb-10",
    last && "mb-0 border-b-0 pb-0",
  );
}

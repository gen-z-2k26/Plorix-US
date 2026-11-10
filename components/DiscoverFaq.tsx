"use client";

import { useMemo, useState } from "react";
import { SmoothAccordion } from "@/components/SmoothAccordion";
import { BlockView, RichText } from "@/components/CustomerCarePage";
import type { CarePage, CareSection } from "@/lib/customer-care";

function sectionText(section: CareSection) {
  return section.blocks
    .map((block) => {
      if (block.type === "faq") return `${block.question} ${block.answer}`;
      if (block.type === "paragraph") return block.text;
      if (block.type === "heading") return block.text;
      if (block.type === "bullets") return block.items.join(" ");
      if (block.type === "numbered") return block.items.join(" ");
      if (block.type === "table") {
        return `${block.headers.join(" ")} ${block.rows.map((row) => `${row.label} ${row.value}`).join(" ")}`;
      }
      if (block.type === "contact") {
        return block.fields.map((field) => `${field.label} ${field.value}`).join(" ");
      }
      return "";
    })
    .join(" ")
    .toLowerCase();
}

export function DiscoverFaq({
  page,
  email = "info@plorix.us",
}: {
  page: CarePage;
  email?: string;
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return page.sections
      .filter((section) => topic === "all" || section.id === topic)
      .map((section) => {
        if (!q) return section;
        const faqs = section.blocks.filter(
          (block) =>
            block.type !== "faq" ||
            block.question.toLowerCase().includes(q) ||
            block.answer.toLowerCase().includes(q),
        );
        const matchesSection = sectionText(section).includes(q);
        if (!matchesSection && !faqs.some((block) => block.type === "faq")) {
          return null;
        }
        return { ...section, blocks: q ? faqs : section.blocks };
      })
      .filter((section): section is CareSection => Boolean(section));
  }, [page.sections, query, topic]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="block max-w-md flex-1 text-sm">
          <span className="mb-2 block text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
            Search questions
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions"
            className="h-11 w-full rounded-[3px] border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
      </div>

      <p className="mb-3 text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
        Browse by topic
      </p>
      <div className="mb-12 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTopic("all")}
          className={`rounded-full border px-3 py-1.5 text-xs ${topic === "all" ? "border-foreground bg-foreground text-background" : "border-border"}`}
        >
          All
        </button>
        {page.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setTopic(section.id)}
            className={`rounded-full border px-3 py-1.5 text-xs ${topic === section.id ? "border-foreground bg-foreground text-background" : "border-border"}`}
          >
            {section.title.replace(/^\d+\.\s+/, "")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching questions found. Try a different search, or email{" "}
          <RichText text={email} />.
        </p>
      ) : (
        <div className="space-y-12">
          {filtered.map((section, index) => {
            const faqs = section.blocks.filter((block) => block.type === "faq");
            const other = section.blocks.filter((block) => block.type !== "faq");
            return (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="font-display mb-5 flex gap-4 text-[27px] font-normal">
                  <span className="text-primary/80 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title.replace(/^\d+\.\s+/, "")}
                </h2>
                {other.map((block, blockIndex) => (
                  <BlockView key={blockIndex} block={block} contactStyle="grid" />
                ))}
                {faqs.length ? (
                  <SmoothAccordion
                    items={faqs.map((block) =>
                      block.type === "faq"
                        ? {
                            title: block.question,
                            content: <RichText text={block.answer} />,
                          }
                        : { title: "", content: null },
                    )}
                  />
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

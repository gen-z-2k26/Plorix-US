import Link from "next/link";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { discoverBySlug } from "@/lib/discover";
import { pageContainer, sectionStackClass, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";

function previewFromLines(lines: string[]) {
  const items: { question: string; answer: string }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\d+\.\s+(.+\?)$/);
    if (!match) continue;
    const answer: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^\d+\.\s+/.test(lines[next])) break;
      if (lines[next].startsWith("* ")) continue;
      answer.push(lines[next]);
      if (answer.length === 2) break;
    }
    items.push({ question: match[1], answer: answer.join(" ") });
    if (items.length === 3) break;
  }
  return items;
}

export function FaqPreviewSection() {
  const page = discoverBySlug("faqs");
  const questions = previewFromLines(page?.lines ?? []);

  if (!questions.length) return null;

  return (
    <section
      aria-labelledby="faq-preview-heading"
      className={cn("border-b border-border", sectionYClass)}
    >
      <div className={pageContainer(sectionStackClass)}>
        <SectionHeader
          eyebrow="FAQs"
          title="A few answers before you order"
          subtitle="Shipping, returns, and product questions are collected in the help center."
          titleId="faq-preview-heading"
          action={
            <Link
              href="/faqs"
              className="text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              All FAQs
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {questions.map((item) => (
              <article key={item.question} className="surface-card h-full p-6">
                <h3 className="text-lg tracking-tight">{item.question}</h3>
                <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </article>
          ))}
        </div>
      </div>
    </section>
  );
}

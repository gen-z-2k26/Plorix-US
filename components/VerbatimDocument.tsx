import { pageContainer } from "@/lib/layout";

function isBullet(line: string) {
  return line.startsWith("* ");
}

function isMeta(line: string) {
  return /^(Effective Date|Last Updated):/i.test(line);
}

function isQuestion(line: string) {
  return line.endsWith("?") && line.length < 160;
}

function isNumberedHeading(line: string) {
  return /^\d+\.\s+\S/.test(line) && line.length < 120 && !/[.!;]$/.test(line);
}

function isTitleHeading(line: string) {
  if (line.length < 8 || line.length > 72) return false;
  if (/[.!?;:]$/.test(line)) return false;
  if (line.includes(": ") || line.includes("@") || /https?:/i.test(line)) return false;
  if (/\d/.test(line)) return false;
  const words = line.trim().split(/\s+/);
  if (words.length < 2 || words.length > 10) return false;
  return words.every(
    (word) =>
      /^[&A-Z]/.test(word.replace(/^[^A-Za-z&]+/, "")) ||
      /^(and|to|for|of|a|the|your|with|in|on|or)$/i.test(word.replace(/[^A-Za-z]/g, "")),
  );
}

function isSectionHeading(line: string) {
  if (isBullet(line) || isMeta(line) || isQuestion(line)) return false;
  return isNumberedHeading(line) || isTitleHeading(line);
}

function splitFact(line: string) {
  const match = line.match(/^([A-Za-z][^:]{1,42}):\s*(.*)$/);
  if (!match) return null;
  const label = match[1].trim();
  const value = match[2].trim();
  if (label.split(/\s+/).length > 5) return null;
  if (value.length > 90) return null;
  return { label, value };
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/^\d+\.\s+/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function eyebrowFor(title: string) {
  const value = title.toLowerCase();
  if (value.includes("about")) return "Our story";
  if (value.includes("faq") || value.includes("question")) return "Help center";
  if (value.includes("contact")) return "Customer care";
  if (value.includes("commitment")) return "Our promise";
  if (
    /shipping|return|refund|cancel|payment|warranty|order help|track/.test(value)
  ) {
    return "Customer care";
  }
  return "Policies";
}

function LineText({ text }: { text: string }) {
  const parts = text.split(
    /(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+\d[\d\s().-]{8,}\d)/gi,
  );
  return parts.map((part, index) => {
    const className =
      "font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent";
    if (/^https?:\/\//i.test(part)) {
      return (
        <a key={index} href={part} className={className}>
          {part}
        </a>
      );
    }
    if (part.includes("@") && part.includes(".")) {
      return (
        <a key={index} href={`mailto:${part}`} className={className}>
          {part}
        </a>
      );
    }
    if (/^\+\d/.test(part)) {
      return (
        <a key={index} href={`tel:${part.replace(/[^\d+]/g, "")}`} className={className}>
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

type Block =
  | { type: "p"; text: string; kind: "question" | "body" }
  | { type: "fact"; label: string; value: string }
  | { type: "ul"; items: string[] };

type Section = { id: string; title: string | null; blocks: Block[] };

function pushLine(blocks: Block[], line: string) {
  if (isBullet(line)) {
    const text = line.slice(2);
    const previous = blocks[blocks.length - 1];
    if (previous?.type === "ul") previous.items.push(text);
    else blocks.push({ type: "ul", items: [text] });
    return;
  }
  const fact = splitFact(line);
  if (fact) {
    blocks.push({ type: "fact", ...fact });
    return;
  }
  blocks.push({
    type: "p",
    text: line,
    kind: isQuestion(line) ? "question" : "body",
  });
}

function sectionsFrom(lines: string[]) {
  const sections: Section[] = [];
  let current: Section = { id: "overview", title: null, blocks: [] };
  for (const line of lines) {
    if (isSectionHeading(line)) {
      if (current.title || current.blocks.length) sections.push(current);
      current = { id: slugify(line) || `section-${sections.length + 1}`, title: line, blocks: [] };
      continue;
    }
    pushLine(current.blocks, line);
  }
  if (current.title || current.blocks.length) sections.push(current);
  return sections;
}

function displayTitle(title: string) {
  return title.replace(/^\d+\.\s+/, "");
}

function BlockView({ block }: { block: Block }) {
  if (block.type === "ul") {
    return (
      <ul className="space-y-2.5">
        {block.items.map((item, index) => (
          <li key={index} className="flex gap-3 text-foreground">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            <span>
              <LineText text={item} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "fact") {
    return (
      <div className="grid gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
        <p className="text-xs font-semibold tracking-[0.12em] text-foreground/70 uppercase">
          {block.label}
        </p>
        <p className="text-foreground">
          {block.value ? <LineText text={block.value} /> : null}
        </p>
      </div>
    );
  }
  if (block.kind === "question") {
    return (
      <p className="rounded-xl bg-muted px-4 py-3 font-semibold text-foreground">
        <LineText text={block.text} />
      </p>
    );
  }
  return (
    <p className="text-foreground">
      <LineText text={block.text} />
    </p>
  );
}

export function VerbatimDocument({ lines }: { lines: string[] }) {
  const [title, ...rest] = lines;
  let cursor = 0;
  let meta: string | null = null;
  let dek: string | null = null;
  if (rest[0] && isMeta(rest[0])) {
    meta = rest[0];
    cursor = 1;
  } else if (
    rest[0] &&
    rest[1] &&
    !isSectionHeading(rest[0]) &&
    !isBullet(rest[0]) &&
    rest[0].length < 120 &&
    !/[.!?]$/.test(rest[0]) &&
    rest[1].length > 80
  ) {
    dek = rest[0];
    cursor = 1;
  }

  const sections = sectionsFrom(rest.slice(cursor));
  const toc = sections.filter((section) => section.title);

  return (
    <article>
      <header className="dark relative overflow-hidden bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,56,248,0.35),transparent_52%)]"
        />
        <div className={pageContainer("relative py-14 sm:py-20")}>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {eyebrowFor(title)}
          </p>
          <h1 className="font-display mt-4 max-w-4xl text-balance text-4xl leading-[1.05] text-white sm:text-6xl">
            {title}
          </h1>
          {dek ? (
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white/80">
              {dek}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-6 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white">
              {meta}
            </p>
          ) : null}
        </div>
      </header>

      <div className="bg-background">
        <div
          className={pageContainer(
            toc.length > 1
              ? "grid gap-10 py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 lg:py-16"
              : "mx-auto max-w-3xl space-y-5 py-12 lg:py-16",
          )}
        >
          {toc.length > 1 ? (
            <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-semibold tracking-[0.16em] text-foreground/60 uppercase">
                On this page
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {toc.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block rounded-lg px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {displayTitle(section.title || "")}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <div className={toc.length > 1 ? "min-w-0 space-y-5" : "space-y-5"}>
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8"
              >
                {section.title ? (
                  <h2 className="font-display text-2xl leading-tight text-foreground sm:text-3xl">
                    {/^\d+\./.test(section.title) ? (
                      <span className="mr-3 font-sans text-[0.7em] font-semibold tracking-normal text-accent">
                        {section.title.match(/^\d+/)?.[0].padStart(2, "0")}
                      </span>
                    ) : null}
                    {displayTitle(section.title)}
                  </h2>
                ) : null}
                <div
                  className={
                    section.title
                      ? "mt-4 space-y-3 text-[15px] leading-7 sm:text-base"
                      : "space-y-3 text-[15px] leading-7 sm:text-base"
                  }
                >
                  {section.blocks.map((block, blockIndex) => (
                    <BlockView key={blockIndex} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

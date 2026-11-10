import { SectionHeader } from "@/components/sections/SectionHeader";
import { Reveal } from "@/components/sections/Reveal";
import { pageContainer, sectionStackClass, sectionYClass } from "@/lib/layout";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    title: "Browse",
    text: "Explore computers, gaming gear, monitors, and accessories in one catalog.",
  },
  {
    number: "02",
    title: "Review",
    text: "Check the price, shipping, and total before you pay.",
  },
  {
    number: "03",
    title: "Checkout",
    text: "Pay with the methods shown at checkout.",
  },
  {
    number: "04",
    title: "Track",
    text: "Use the details in your confirmation on the order tracking page.",
  },
];

export function StepsSection() {
  return (
    <section
      aria-labelledby="steps-heading"
      className={cn("border-b border-border", sectionYClass)}
    >
      <div className={pageContainer(sectionStackClass)}>
        <SectionHeader
          eyebrow="How ordering works"
          title="Browse, review, then track"
          subtitle="A straightforward path from the catalog to a shipment you can follow."
          titleId="steps-heading"
        />

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06} as="li">
              <div className="surface-card h-full space-y-4 p-6">
                <p className="font-display inline-flex size-12 items-center justify-center rounded-full bg-primary/25 text-lg text-foreground">
                  {item.number}
                </p>
                <h3 className="text-lg tracking-tight">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import type { ServicePageContent } from "@/content/services";

/** T-045/T-046 · «Кому подходит» — четыре карточки сценариев из контента. */
export function ServiceUseCasesSection({ service }: { service: ServicePageContent }) {
  const items = service.useCases.items;
  if (items.length === 0) return null;

  return (
    <Section className="bg-slate-50 py-12 sm:py-16">
      <Container>
        <Heading eyebrow="Когда подходит" title={service.useCases.sectionTitle} align="center" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}

import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import type { ServicePageContent } from "@/content/services";

/**
 * T-045/T-046 · Текстовый блок «о работе» — контент уже лежал в
 * `content/services.ts`, но на части страниц просто не рендерился.
 */
export function ServiceAboutSection({ service }: { service: ServicePageContent }) {
  const paragraphs = service.about.paragraphs;
  if (paragraphs.length === 0) return null;

  return (
    <Section className="bg-white py-12 sm:py-16">
      <Container>
        <Heading eyebrow="Подробнее" title={service.about.sectionTitle} />

        <div className="mt-6 max-w-3xl space-y-4">
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-base leading-7 text-slate-600">
              {paragraph}
            </p>
          ))}
        </div>
      </Container>
    </Section>
  );
}

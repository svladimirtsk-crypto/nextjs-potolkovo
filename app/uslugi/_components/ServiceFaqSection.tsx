import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { JsonLd } from "@/components/seo/json-ld";
import { buildFaqSchema } from "@/lib/seo-schema";
import type { ServicePageContent } from "@/content/services";

/**
 * T-046 · FAQ услуги: нативный аккордеон + FAQPage JSON-LD.
 *
 * Используем `details/summary`, а не React-состояние: секция остаётся
 * серверной, работает без JS и открывается поиском по странице.
 */
export function ServiceFaqSection({ service }: { service: ServicePageContent }) {
  const items = service.faq;
  if (items.length === 0) return null;

  return (
    <Section className="bg-white py-12 sm:py-16">
      <JsonLd data={buildFaqSchema([...items])} />
      <Container>
        <Heading eyebrow="Вопросы" title="Частые вопросы" align="center" />

        <div className="mx-auto mt-8 max-w-3xl space-y-3">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 open:bg-slate-50"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-950">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-slate-500 transition-transform group-open:rotate-45"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}

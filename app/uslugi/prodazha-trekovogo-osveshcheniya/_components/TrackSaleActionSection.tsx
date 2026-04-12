import { contacts } from "@/content/contacts";
import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { TrackSaleActionForm } from "./TrackSaleActionForm";

type TrackSaleActionSectionProps = {
  service: ServicePageContent;
};

export function TrackSaleActionSection({ service }: TrackSaleActionSectionProps) {
  return (
    <Section id="action" className="scroll-mt-24 bg-white">
      <Container>
        <div className="mx-auto max-w-xl">
          <Heading
            eyebrow="Заявка"
            title={service.action.sectionTitle}
            description={service.action.sectionSubtitle}
          />

          <div className="mt-10">
            <TrackSaleActionForm />
          </div>

          <div className="mt-8 border-t border-slate-200 pt-8">
            <p className="text-center text-sm font-medium text-slate-900 mb-4">
              Или свяжитесь напрямую
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                href={contacts.phoneHref}
                variant="secondary"
                className="justify-center"
              >
                {contacts.phoneDisplay}
              </Button>
              <Button
                href={contacts.telegramUrl}
                variant="secondary"
                className="justify-center"
              >
                Написать в Telegram
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

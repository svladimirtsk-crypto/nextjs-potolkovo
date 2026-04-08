import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import type { ServicePageContent } from "@/content/services";

import { ActionForm } from "@/components/home/action-form";
import { Container } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { TextLink } from "@/components/ui/text-link";

type ServiceActionSectionProps = {
  service: ServicePageContent;
};

const actionContent = homepage.action;

export function ServiceActionSection({ service }: ServiceActionSectionProps) {
  return (
    <Section id="action" className="scroll-mt-24 bg-white">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          {/* LEFT: heading + form card (как на главной) */}
          <div>
            <Heading
              eyebrow="Заявка"
              title={service.action.sectionTitle}
              description={service.action.sectionSubtitle}
            />

            <div className="mt-8 max-w-xl rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:p-8">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Бесплатный замер и расчёт стоимости
              </h3>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                Оставьте контакты, и я свяжусь с вами, чтобы уточнить задачу и
                договориться о выезде.
              </p>

              <div className="mt-6">
                <ActionForm />
              </div>
            </div>
          </div>

          {/* RIGHT: contacts card (как на главной) */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">
              {actionContent.secondaryContactsTitle}
            </h3>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm text-slate-500">Телефон</p>
                <div className="mt-2">
                  <TextLink
                    href={contacts.phoneHref}
                    className="text-base font-medium"
                  >
                    {contacts.phoneDisplay}
                  </TextLink>
                </div>
              </div>

              <Divider />

              <div>
                <p className="text-sm text-slate-500">Telegram</p>
                <div className="mt-2">
                  <TextLink
                    href={contacts.telegramUrl}
                    className="text-base font-medium"
                  >
                    {contacts.telegramDisplay}
                  </TextLink>
                </div>
              </div>

              <Divider />

              <div>
                <p className="text-sm text-slate-500">Email</p>
                <div className="mt-2">
                  <TextLink
                    href={contacts.emailHref}
                    className="text-base font-medium"
                  >
                    {contacts.emailDisplay}
                  </TextLink>
                </div>
              </div>

              <Divider />

              <div className="space-y-2">
                <p className="text-sm text-slate-500">{contacts.regionLabel}</p>
                {contacts.workingHoursLabel ? (
                  <p className="text-sm text-slate-500">
                    {contacts.workingHoursLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

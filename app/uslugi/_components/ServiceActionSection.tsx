import { contacts } from "@/content/contacts";
import type { ServicePageContent } from "@/content/services";
import { ActionForm } from "@/components/home/action-form";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ServiceActionSectionProps = {
  service: ServicePageContent;
};

export function ServiceActionSection({
  service,
}: ServiceActionSectionProps) {
  return (
    <section
      id="action"
      aria-labelledby={`${service.slug}-action-title`}
      className="scroll-mt-24 bg-slate-50 py-16 sm:py-20"
    >
      <Container>
        <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Заявка
            </p>

            <h2
              id={`${service.slug}-action-title`}
              className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              {service.action.sectionTitle}
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              {service.action.sectionSubtitle}
            </p>

            <div className="mt-8 space-y-4 rounded-[1.5rem] bg-slate-50 p-5">
              <div>
                <p className="text-sm font-medium text-slate-500">Телефон</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.phoneDisplay}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Telegram</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.telegramDisplay}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Регион</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.regionLabel}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">График</p>
                <p className="mt-1 text-base font-semibold text-slate-950">
                  {contacts.workingHoursLabel}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button href={contacts.phoneHref} variant="secondary">
                {service.hero.secondaryPhoneCtaLabel}
              </Button>

              <Button href={contacts.telegramUrl} variant="ghost">
                {service.hero.secondaryTelegramCtaLabel}
              </Button>
            </div>
          </div>

          <div className="min-w-0">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                <h3 className="text-lg font-semibold text-slate-950">
                  Бесплатный замер и расчёт стоимости
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Оставьте контакты, и я свяжусь с вами, чтобы уточнить задачу и
                  договориться о выезде.
                </p>
              </div>

              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <ActionForm />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

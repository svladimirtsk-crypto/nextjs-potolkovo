import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { TextLink } from "@/components/ui/text-link";

import { ActionForm } from "./action-form";

const actionContent = homepage.action;

export function HomeAction() {
  return (
    <Section id={actionContent.anchorId ?? "action"} className="bg-white">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <Heading
              eyebrow="Заявка"
              title={actionContent.sectionTitle}
              description={actionContent.sectionSubtitle}
            />

            <div className="mt-8 max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
              {actionContent.formTitle ? (
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  {actionContent.formTitle}
                </h3>
              ) : null}

              <div className={actionContent.formTitle ? "mt-6" : ""}>
                <ActionForm />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">
              {actionContent.secondaryContactsTitle}
            </h3>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm text-slate-500">Телефон</p>
                <div className="mt-2">
                  <TextLink href={contacts.phoneHref} className="text-base font-medium">
                    {contacts.phoneDisplay}
                  </TextLink>
                </div>
              </div>

              <Divider />

              <div>
                <p className="text-sm text-slate-500">Telegram</p>
                <div className="mt-2">
                  <TextLink href={contacts.telegramUrl} className="text-base font-medium">
                    {contacts.telegramDisplay}
                  </TextLink>
                </div>
              </div>

              <Divider />

              <div>
                <p className="text-sm text-slate-500">Email</p>
                <div className="mt-2">
                  <TextLink href={contacts.emailHref} className="text-base font-medium">
                    {contacts.emailDisplay}
                  </TextLink>
                </div>
              </div>

              <Divider />

              <div className="space-y-2">
                <p className="text-sm text-slate-500">{contacts.regionLabel}</p>
                {contacts.workingHoursLabel ? (
                  <p className="text-sm text-slate-500">{contacts.workingHoursLabel}</p>
                ) : null}
                {contacts.responseTimeLabel ? (
                  <p className="text-sm text-slate-500">{contacts.responseTimeLabel}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

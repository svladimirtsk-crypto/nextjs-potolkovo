import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import { legal } from "@/content/legal";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";

import { ServiceLinksList } from "./service-links-list";

export function HomeFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-[0.28em] text-slate-950">
              {contacts.brandName}
            </p>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
              {homepage.footer.footerNote}
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold text-slate-950">
              {homepage.footer.servicesGroupLabel}
            </h2>
            <ServiceLinksList variant="footer" />
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold text-slate-950">
              {homepage.footer.contactsGroupLabel}
            </h2>
            <div className="space-y-3">
              <TextLink href={contacts.phoneHref}>{contacts.phoneDisplay}</TextLink>
              <TextLink href={contacts.telegramUrl}>{contacts.telegramDisplay}</TextLink>
              <TextLink href={contacts.emailHref}>{contacts.emailDisplay}</TextLink>
              <p className="text-sm text-slate-500">{contacts.regionLabel}</p>
              {contacts.workingHoursLabel ? (
                <p className="text-sm text-slate-500">{contacts.workingHoursLabel}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {homepage.footer.copyrightLine}</p>

          <TextLink href={legal.privacyHref}>
            {homepage.footer.privacyLinkLabelOverride ?? legal.privacyLabel}
          </TextLink>
        </div>
      </Container>
    </footer>
  );
}

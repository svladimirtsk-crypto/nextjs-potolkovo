import { homepage } from "@/content/homepage";
import { legal } from "@/content/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextLink } from "@/components/ui/text-link";

const actionContent = homepage.action;

export function ActionForm() {
  return (
    <form className="space-y-5">
      <Input
        label={actionContent.nameFieldLabel}
        name="name"
        type="text"
        placeholder={actionContent.nameFieldPlaceholder}
        autoComplete="name"
        required
      />

      <Input
        label={actionContent.phoneFieldLabel}
        name="phone"
        type="tel"
        placeholder={actionContent.phoneFieldPlaceholder}
        autoComplete="tel"
        inputMode="tel"
        required
      />

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <Button type="submit" className="w-full justify-center">
        {actionContent.submitButtonLabel}
      </Button>

      <p className="text-sm leading-6 text-slate-600">{actionContent.helperText}</p>

      <p className="text-xs leading-5 text-slate-500">
        {legal.consentTextPrefix}
        <TextLink href={legal.privacyHref} className="text-xs">
          {legal.privacyLabel}
        </TextLink>
        {legal.consentTextSuffix}
      </p>
    </form>
  );
}

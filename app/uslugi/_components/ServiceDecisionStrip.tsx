import type { Phase2ServiceSlug } from "@/content/services";
import { servicePresentation } from "@/content/service-presentation";
import { Container } from "@/components/ui/container";

export function ServiceDecisionStrip({ slug }: { slug: Phase2ServiceSlug }) {
  const view = servicePresentation[slug];
  const items = [["Результат", view.result], ["Продумать вместе", view.together], ["Что проверяем", view.check]];
  return <section className="pk-service-decisions" aria-label="Что важно для этого решения"><Container><div>
    {items.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}
  </div></Container></section>;
}

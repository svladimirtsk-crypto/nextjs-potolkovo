import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

const promise = homepage.promise;

export function HomePromise() {
  return (
    <Section id="promise" className="bg-slate-950 text-white">
      <Container>
        <Heading
          eyebrow="Гарантии"
          title={promise.sectionTitle}
          description={promise.sectionIntro}
          tone="dark"
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {promise.guarantees.map((item) => (
            <article
              key={item.label}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-6"
            >
              <p className="text-lg font-semibold tracking-tight text-white">
                {item.label}
              </p>

              {item.detail ? (
                <p className="mt-3 text-sm leading-7 text-white/72">
                  {item.detail}
                </p>
              ) : null}
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-6 sm:p-8">
          <p className="text-base leading-7 text-white/82">{promise.includedLine}</p>

          {promise.closingNote ? (
            <p className="mt-4 text-sm leading-7 text-white/60">
              {promise.closingNote}
            </p>
          ) : null}
        </div>

        <div className="mt-12">
          {promise.processTitle ? (
            <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {promise.processTitle}
            </h3>
          ) : null}

          <div className="mt-6 space-y-4">
            {promise.processSteps.map((step) => (
              <div
                key={`${step.stepLabel ?? ""}-${step.title}`}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6"
              >
                <div className="flex items-start gap-4">
                  {step.stepLabel ? (
                    <span className="mt-0.5 shrink-0 font-mono text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
                      {step.stepLabel}
                    </span>
                  ) : null}

                  <div>
                    <p className="text-base font-semibold text-white">{step.title}</p>
                    {step.description ? (
                      <p className="mt-2 text-sm leading-7 text-white/72">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

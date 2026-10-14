import { homepage } from "@/content/homepage";

export function HomePromise() {
  return (
    <section id="promise" className="pk-section pk-wrap" aria-labelledby="process-title">
      <div className="pk-section-head"><div><p className="pk-eyebrow">Как устроена работа</p><h2 id="process-title">Понятно на каждом этапе.</h2></div><p>{homepage.promise.sectionIntro}</p></div>
      <div className="pk-process">{homepage.promise.processSteps.map((step, index) => <article key={step.title}>
        <span>0{index + 1} /</span><h3>{step.title}</h3><p>{step.description}</p>
      </article>)}</div>
    </section>
  );
}

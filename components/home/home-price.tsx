import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";

const priceContent = homepage.price;

export function HomePrice() {
  return (
    <section
      id="price"
      aria-labelledby="price-title"
      className="scroll-mt-24 bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Цена
          </p>

          <h2
            id="price-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {priceContent.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {priceContent.sectionIntro}
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { title: "1. Потолок", text: "Площадь, профиль, карнизы и монтаж." },
            { title: "2. Освещение", text: "Каталог треков, точек и ламп со скидкой −25%." },
            { title: "3. Итог", text: "Смета уйдёт в заявку вместе с составом." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-sm font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 sm:mt-12">
          <CalculatorTeaser source="homepage" />
        </div>
      </Container>
    </section>
  );
}

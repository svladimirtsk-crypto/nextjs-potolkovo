import type { Metadata } from "next";
import ServicePageLayout from "../_components/ServicePageLayout";

export const metadata: Metadata = {
  title: "Скрытый карниз в натяжном потолке — Москва | ПОТОЛКОВО",
  description: "Ниша под карниз в натяжном потолке. Шторы из потолка — чистый вид без накладок. Мастер 15+ лет. Замер бесплатно.",
  keywords: "скрытый карниз, ниша для штор, карниз в потолке, шторы из потолка",
};

export default function Page() {
  return (
    <ServicePageLayout
      breadcrumb="Скрытые карнизы"
      badge="Услуга"
      h1="Скрытые карнизы"
      h1sub="шторы из потолка"
      description="Ниша под карниз прямо в натяжном потолке. Карниз не виден, шторы начинаются от потолка. Чистый вид без пластиковых накладок."
      ctaText="Заказать скрытый карниз"
      price="Рассчитывается индивидуально"
      image="/svc-cornice.jpeg"
      imageAlt="Скрытый карниз в натяжном потолке"
      sectionTitle="Как устроен скрытый карниз?"
      sectionParagraphs={[
        "В натяжном потолке формируется ниша у окна. В нишу устанавливается обычный карниз — электрический или ручной.",
        "Снаружи видна только ровная поверхность потолка и шторы, свободно падающие от самого потолка. Никаких труб и креплений на виду.",
        "Важно: нишу нужно планировать до натяжки потолка. Если потолок уже установлен — переделать можно, но это сложнее.",
      ]}
      advantagesTitle="Преимущества"
      advantages={[
        { icon: "🪟", title: "Шторы из потолка", desc: "Нет карниза на виду — чистый вид" },
        { icon: "📏", title: "Любой карниз", desc: "Ручной, электрический, многорядный" },
        { icon: "🎨", title: "Любой стиль", desc: "Минимализм, классика, лофт" },
        { icon: "✨", title: "Визуальная высота", desc: "Шторы от потолка увеличивают высоту" },
      ]}
      otherServices={[
        ["Теневой профиль", "/uslugi/tenevoy-profil"],
        ["Парящие потолки", "/uslugi/paryashchie-potolki"],
        ["Световые линии", "/uslugi/svetovye-linii"],
        ["Трековое освещение", "/uslugi/trekovoe-osveshchenie"],
        ["Индивидуальные проекты", "/uslugi/individualnye-proekty"],
        ["Продажа трек-света", "/uslugi/prodazha-trekovogo-osveshcheniya"],
        ["Простые потолки", "/uslugi/prostye-potolki"],
        ["Светопрозрачные потолки", "/uslugi/svetoprozrachnye-potolki"],
      ]}
    />
  );
}

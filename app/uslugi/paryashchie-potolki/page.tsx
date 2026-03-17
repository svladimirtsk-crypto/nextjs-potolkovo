import type { Metadata } from "next";
import ServicePageLayout from "../_components/ServicePageLayout";

export const metadata: Metadata = {
  title: "Парящие натяжные потолки с подсветкой в Москве — ПОТОЛКОВО",
  description: "Парящие натяжные потолки с LED-подсветкой в Москве и МО. Эффект невесомости, управление с пульта. Мастер 15+ лет. Замер бесплатно.",
  keywords: "парящий потолок, натяжной потолок с подсветкой, LED потолок, парящие потолки москва",
};

export default function Page() {
  return (
    <ServicePageLayout
      breadcrumb="Парящие потолки"
      badge="Услуга"
      h1="Парящие потолки"
      h1sub="с LED-подсветкой"
      description="Потолок визуально «отрывается» от стен благодаря LED-ленте по периметру. Мягкое свечение создаёт эффект невесомости. Управление с пульта или смартфона."
      ctaText="Заказать парящий потолок"
      price="от 2 500 ₽/м.пог"
      image="/svc-floating.jpeg"
      imageAlt="Парящий натяжной потолок с LED подсветкой"
      sectionTitle="Как это работает"
      sectionParagraphs={[
        "Специальный профиль с пазом для LED-ленты крепится по периметру помещения. Лента светит вниз на стену, создавая световой контур.",
        "Визуально потолок «парит» в воздухе, отделённый от стен полосой света. Эффект усиливается в вечернее время.",
        "Управление яркостью и цветом — с пульта или через приложение. Тёплый белый, холодный белый или RGB.",
      ]}
      advantagesTitle="Где использовать"
      advantages={[
        { icon: "🛏️", title: "Спальня", desc: "Как ночник или основной свет" },
        { icon: "🛋️", title: "Гостиная", desc: "Декоративная подсветка зоны отдыха" },
        { icon: "🚪", title: "Коридор", desc: "Основной свет без люстр" },
        { icon: "🍳", title: "Кухня", desc: "Дополнительный контурный свет" },
      ]}
      otherServices={[
        ["Теневой профиль", "/uslugi/tenevoy-profil"],
        ["Световые линии", "/uslugi/svetovye-linii"],
        ["Трековое освещение", "/uslugi/trekovoe-osveshchenie"],
        ["Скрытые карнизы", "/uslugi/skrytye-karnizy"],
        ["Индивидуальные проекты", "/uslugi/individualnye-proekty"],
        ["Продажа трек-света", "/uslugi/prodazha-trekovogo-osveshcheniya"],
        ["Простые потолки", "/uslugi/prostye-potolki"],
        ["Светопрозрачные потолки", "/uslugi/svetoprozrachnye-potolki"],
      ]}
    />
  );
}

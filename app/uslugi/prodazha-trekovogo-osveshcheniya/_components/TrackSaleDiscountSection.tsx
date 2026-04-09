import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { catalog } from "@/content/eksmarket-assortment";

export function TrackSaleDiscountSection() {
  return (
    <Section id="proof" className="scroll-mt-24 bg-slate-50">
      <Container>
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 sm:p-12 text-white text-center">
          <span className="inline-block bg-white/10 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6 backdrop-blur">
            Специальное предложение
          </span>
          
          <Heading
            title={`Скидка ${catalog.discountPercentForCeilingOrder}% на всё трековое освещение`}
            description={`При заказе натяжных потолков — скидка ${catalog.discountPercentForCeilingOrder}% на весь ассортимент трековых систем от ${catalog.supplierName}.`}
            align="center"
            tone="dark"
            className="text-white [&_p]:text-white/80"
          />

          <div className="mt-8">
            <Button href="#action" className="justify-center py-6 text-base">
              Записаться на замер
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}

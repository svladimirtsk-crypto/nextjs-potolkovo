"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

export function LightCustomSection() {
  const { openCalculator } = useCalculatorModal();

  const handleClick = () => {
    openCalculator({
      initialStep: 1,
      source: "track-sale-custom",
    });
  };

  return (
    <Section id="price" className="scroll-mt-24 bg-white">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Heading
            eyebrow="Свой вариант"
            title="Есть свои пожелания по освещению?"
            description="Соберите свой комплект: выберите тип трека, количество спотов, температуру света — и мы подготовим смету."
          />

          <div className="mt-8">
            <Button
              type="button"
              className="justify-center py-6 text-base"
              onClick={handleClick}
            >
              Собрать свой комплект
            </Button>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Или рассчитайте потолок + освещение вместе — откроется полный калькулятор
          </p>
        </div>
      </Container>
    </Section>
  );
}

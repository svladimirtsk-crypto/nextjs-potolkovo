"use client";

import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { DEFAULT_CALCULATOR_AREA } from "@/lib/catalog-ui-config";

export function LightCustomSection() {
  const { openCalculator } = useCalculatorModal();

  return (
    <Section id="price" className="scroll-mt-24 bg-white">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Heading
            eyebrow="Свой вариант"
            title="Хотите подобрать самостоятельно?"
            description="Откройте каталог прямо в калькуляторе - выберите позиции, количество и сразу увидите итоговую стоимость со скидкой 15%."
            align="center"
          />

          <div className="mt-8 space-y-4">
            <CalculatorTeaser
              source="track-sale-custom"
              heading="Открыть каталог в калькуляторе"
              buttonLabel="Открыть каталог в калькуляторе"
            />

            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openCalculator({
                    initialStep: 0,
                    source: "track-sale-calculator",
                    preset: {
                      ceilingType: "standard",
                      areaDefault: DEFAULT_CALCULATOR_AREA,
                    },
                  })
                }
                className="justify-center"
              >
                Рассчитать потолок
              </Button>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Или прокрутите ниже - полный каталог с фильтрами доступен на этой странице
          </p>
        </div>
      </Container>
    </Section>
  );
}

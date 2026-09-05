"use client";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

export function LightCustomSection() {
  const { openCalculator } = useCalculatorModal();

  return (
    <Section id="price" className="scroll-mt-24 bg-white">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Heading
            eyebrow="Свой вариант"
            title="Хотите подобрать самостоятельно?"
            description="Выберите позиции и количество: только освещение — со скидкой 10%, вместе с потолком — скидка 25% на свет."
            align="center"
          />

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              onClick={() =>
                openCalculator({
                  entryMode: "lighting-first",
                  initialStep: 1,
                  initialLightingTab: "catalog",
                  initialLightingView: "browse",
                  source: "track-sale-custom",
                })
              }
              className="justify-center py-6 text-base"
            >
              Собрать комплект
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                openCalculator({
                  initialStep: 0,
                  source: "track-sale-calculator",
                })
              }
              className="justify-center"
            >
              С потолком −25 %
            </Button>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Или прокрутите ниже — полный каталог с фильтрами доступен на этой странице
          </p>
        </div>
      </Container>
    </Section>
  );
}

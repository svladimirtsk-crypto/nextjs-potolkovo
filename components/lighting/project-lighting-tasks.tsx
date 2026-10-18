"use client";
import Link from "next/link";
import { ledCatalogHrefForTask, type ProjectLightingTask } from "@/lib/lighting/project-lighting-tasks";
import { Button } from "@/components/ui/button";

/** Geometric requests, not verified control zones or a purchased kit. */
export function ProjectLightingTasks({ tasks, onContinue, onOpenCatalog, compact = false }: {
  tasks: readonly ProjectLightingTask[]; onContinue?: () => void; onOpenCatalog?: () => void; compact?: boolean;
}) {
  if (!tasks.length) return null;
  return <section className={`pk-led-tasks ${compact ? "pk-led-tasks--compact" : ""}`} data-testid="project-lighting-tasks" aria-label="Задачи по свету из помещений">
    <div className="pk-led-tasks-heading"><div><p>ПОМЕЩЕНИЯ → СВЕТ</p><h3>Что нужно подобрать</h3></div><span>Нужна проверка</span></div>
    <p className="pk-led-tasks-intro">Контуры, линии и подсветка из вашего расчёта. Не нужно вводить их заново.</p>
    <ul>{tasks.map(task => <li key={task.id} data-task-id={task.id}>
      <div><small>{task.roomLabel}</small><b>{task.title}</b>
        {onOpenCatalog ? <Link href={ledCatalogHrefForTask(task)} onClick={onOpenCatalog}
          className="pk-led-task-link" data-testid="led-task-catalog-link"
          aria-label={`Посмотреть ленты и питание: ${task.roomLabel}, ${task.title}`}>
          Посмотреть ленту и питание <span aria-hidden="true">↗</span>
        </Link> : null}
      </div>
      <strong>{task.geometryMeters === null ? "Метраж уточнить" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(task.geometryMeters)} м конструкции`}</strong>
    </li>)}</ul>
    <p className="pk-led-tasks-note">Это геометрический метраж, не количество катушек и не готовый комплект. Ленту, число рядов, блоки питания, контроллеры и пульты нужно проверить по моделям и схеме. Товары автоматически не добавляем.</p>
    <p className="pk-led-tasks-note">Позиции, уже включённые в потолочную ставку, не должны оплачиваться повторно. Итоговый состав уточним до заказа. Эти задачи сохранятся вместе с помещениями в заявке.</p>
    {onContinue && <Button size="sm" onClick={onContinue}>Передать задачи на подбор</Button>}
  </section>;
}

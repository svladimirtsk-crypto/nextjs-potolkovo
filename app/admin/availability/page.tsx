import type { Metadata } from "next";

import { AvailabilityAdmin } from "./availability-admin";

/**
 * PT-016 · Служебная страница календаря замеров.
 *
 * Страница-обёртка намеренно серверная: клиентский компонент не может
 * экспортировать `metadata`, а служебный раздел обязан быть закрыт от
 * индексации (`robots`) и из `robots.txt` (см. `app/robots.ts`).
 *
 * Секретов в разметке нет: пароль владелец вводит сам, он уходит только в
 * заголовке запроса к `/api/admin/availability` и хранится в `sessionStorage`
 * вкладки (стирается при её закрытии).
 */
export const metadata: Metadata = {
  title: "Календарь замеров — служебная страница",
  description: "Обновление свободных дат замера без деплоя.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminAvailabilityPage() {
  return <AvailabilityAdmin />;
}

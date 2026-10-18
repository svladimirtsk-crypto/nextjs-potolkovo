"use client";

/** PT-044: единый лёгкий line-набор. Текст кнопки, а не пиктограмма, несёт смысл. */
export const ROOM_TYPES = [
  "Кухня", "Гостиная", "Спальня", "Детская", "Кабинет",
  "Санузел", "Коридор", "Прихожая", "Другое",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export function RoomTypeIcon({ type }: { type: RoomType }) {
  const drawing = (() => {
    switch (type) {
      case "Кухня":
        return <path d="M4 9h16v5a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V9ZM3 9h18M8 9V6m8 3V6M9 4h6" />;
      case "Гостиная":
        return <path d="M5 13V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M3 13a2 2 0 0 1 2 2v3h14v-3a2 2 0 0 1 2-2v7H3v-7ZM7 18v2m10-2v2M12 6v7" />;
      case "Спальня":
        return <path d="M3 20V7m18 13V7M3 15h18v4H3v-4ZM5 10a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3H5v-3Zm7 0a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3h-7v-3Z" />;
      case "Детская":
        return <path d="M3 13h8v8H3v-8Zm10 2h8v6h-8v-6ZM8 3l1.2 2.6L12 6l-2.1 2 .5 3L8 9.5 5.6 11l.5-3L4 6l2.8-.4L8 3Z" />;
      case "Кабинет":
        return <path d="M5 4h14v11H5V4ZM3 19h18M9 15v4m6-4v4M8 8h8m-8 3h5" />;
      case "Санузел":
        return <path d="M3 13h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2ZM6 13V7a3 3 0 0 1 6 0M4 20l-1 2m16-2 1 2M10 7h5" />;
      case "Коридор":
        return <path d="M4 21V3h16v18M8 21V7h8v14M3 21h18M13 14h1m-6-7-4-4m12 4 4-4" />;
      case "Прихожая":
        return <path d="M12 3v3a2 2 0 0 1 2 2c0 1-1 2-2 2L4 15h16l-8-5M5 19h14M7 15v4m10-4v4" />;
      case "Другое":
        return <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4Zm-9 9h7v7H4v-7Zm9 0h7v7h-7v-7Z" />;
    }
  })();
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-room-icon={type}>
    {drawing}
  </svg>;
}

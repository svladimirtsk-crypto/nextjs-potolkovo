"use client";

import { useEffect } from "react";
import { RecoveryScreen } from "@/components/brand/recovery-screen";

/** Page-segment boundary; does not claim to catch errors in the root layout. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] необработанная ошибка страницы", error);
  }, [error]);

  return <RecoveryScreen kind="error" reset={reset} />;
}

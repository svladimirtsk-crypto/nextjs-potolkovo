/**
 * PT-048 · Пилот миниатюр квиза. NEXT_PUBLIC_* встраивается в клиентский bundle
 * при сборке: переключение требует нового build/deploy, а не restart сервера.
 *
 * До baseline и разрешённого эксперимента — off. На первом этапе on открывает
 * только ceiling/cornice/track; lightLines остаётся текстовым, прежний
 * ScenarioScreen снят UX-R2 и не возвращается ради картинки.
 */
export function showQuizStepImages(
  screen: string,
  flag: string | undefined = process.env.NEXT_PUBLIC_QUIZ_STEP_IMAGES
): boolean {
  return flag === "on" && (screen === "ceiling" || screen === "cornice" || screen === "track");
}

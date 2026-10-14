"use client";

import { useState, type CSSProperties } from "react";
import { BrandPicture } from "./brand-picture";
import { lightingScenes } from "@/content/brand-pages";

/** An explicitly illustrative switcher. Does not write calculator, cart or lead state. */
export function LightingScenes() {
  const [selected, setSelected] = useState(0);
  const scene = lightingScenes[selected];
  return (
    <div className="pk-scenes" data-scene={scene.id}>
      <div className="pk-scenes-image" style={{ "--scene-brightness": scene.brightness } as CSSProperties}>
        <BrandPicture id="floating-bedroom" priority sizes="(max-width: 900px) 100vw, 55vw" />
        <span className="pk-scenes-image-note">Иллюстрация сценария · не характеристики комплекта</span>
      </div>
      <div className="pk-scenes-controls" role="group" aria-label="Примеры сценариев освещения">
        {lightingScenes.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} aria-controls="scene-description" onClick={() => setSelected(index)}>{item.label}</button>)}
      </div>
      <div id="scene-description" className="pk-scenes-description" aria-live="polite" aria-atomic="true"><h2>{scene.title}</h2><p>{scene.text}</p></div>
      <p className="pk-scenes-disclaimer">На изображении условно меняется яркость. Это не светотехнический расчёт и не демонстрация работы оборудования.</p>
    </div>
  );
}

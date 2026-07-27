"use client";
import { useEffect, useRef, useState, ReactNode } from "react";

export function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function OptionCard({ active, title, meta, onClick }: { active: boolean; title: string; meta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border p-4 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-400"}`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-500"}`}>{meta}</p>
    </button>
  );
}

function clamp(v:number,min:number,max:number){return Math.min(max,Math.max(min,v))}
function roundToStep(v:number,step:number){return step<=0?Math.round(v):Math.round(v/step)*step}

export function RangeField({ id, label, value, min, max, step, unit, onChange, quickValues }:{
  id:string; label:string; value:number; min:number; max:number; step:number; unit:string;
  onChange:(v:number)=>void; quickValues?:number[];
}) {
  const [manual,setManual]=useState(String(value));
  const focused=useRef(false);
  useEffect(()=>{ if(!focused.current) setManual(String(value)); },[value]);
  const normalize=(n:number)=>clamp(roundToStep(n,step),min,max);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>onChange(normalize(value-step))} className="h-8 w-8 rounded-full border">−</button>
          <input id={id} value={manual}
            onFocus={()=>{focused.current=true}}
            onChange={e=>{setManual(e.target.value); const p=Number(e.target.value.replace(",",".")); if(Number.isFinite(p)) onChange(clamp(p,min,max));}}
            onBlur={()=>{focused.current=false; setManual(String(value))}}
            className="w-20 text-center rounded-full ring-1 ring-slate-200 px-2 py-1 text-sm font-semibold"
          />
          <span className="text-sm font-semibold">{unit}</span>
          <button type="button" onClick={()=>onChange(normalize(value+step))} className="h-8 w-8 rounded-full border">+</button>
        </div>
      </div>
      {quickValues && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickValues.map(q=>(
            <button key={q} type="button" onClick={()=>onChange(q)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${Math.abs(value-q)<0.001 ? "bg-slate-950 text-white":"bg-white ring-1 ring-slate-200"}`}>
              {q} {unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

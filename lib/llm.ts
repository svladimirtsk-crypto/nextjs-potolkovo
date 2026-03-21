// file: lib/llm.ts

import type { AdvisorOutput } from "./types";
import { advisorOutputSchema } from "./schemas";

const AMVERA_API_KEY = process.env.AMVERA_API_KEY || "";
const AMVERA_BASE_URL =
  process.env.AMVERA_BASE_URL ||
  "https://kong-proxy.yc.amvera.ru/api/v1";
const AMVERA_MODEL = process.env.AMVERA_MODEL || "gpt-4.1";
const MOCK_AI = process.env.MOCK_AI === "true";

interface AmveraMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

interface AmveraRequestBody {
  model: string;
  messages: AmveraMessage[];
  temperature?: number;
  max_completion_tokens?: number;
  n?: number;
}

interface AmveraResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      text: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function buildPayload(messages: AmveraMessage[]): AmveraRequestBody {
  return {
    model: AMVERA_MODEL,
    messages,
    // 0.5 — достаточно для разнообразных, но стабильных ответов.
    // Ниже 0.3 — слишком шаблонно. Выше 0.7 — начинает фантазировать.
    temperature: 0.5,
    // ~2000 символов ответа ≈ 600-800 токенов.
    // 1200 даёт запас для JSON-обёртки и структуры.
    max_completion_tokens: 1200,
    n: 1,
  };
}

/**
 * Извлекает JSON из ответа модели, даже если тот обёрнут
 * в markdown-блок или содержит пояснительный текст.
 */
function extractJSON(text: string): string {
  // Markdown code fence
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    const obj = inner.match(/\{[\s\S]*\}/);
    if (obj) return obj[0];
    return inner;
  }

  // Прямой JSON-объект
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text;
}

function parseResponse(raw: string): AdvisorOutput | null {
  try {
    const jsonStr = extractJSON(raw);
    const parsed = JSON.parse(jsonStr);
    const validated = advisorOutputSchema.safeParse(parsed);
    if (validated.success) return validated.data;
    console.error("[LLM] Zod validation failed:", validated.error.issues);
    return null;
  } catch (e) {
    console.error("[LLM] JSON parse failed:", e);
    return null;
  }
}

export async function callLLM(
  system: string,
  user: string,
  mockFallback: AdvisorOutput
): Promise<AdvisorOutput> {
  if (MOCK_AI) {
    console.log("[LLM] MOCK_AI=true, returning mock");
    return mockFallback;
  }

  if (!AMVERA_API_KEY) {
    console.warn("[LLM] No AMVERA_API_KEY set, returning mock");
    return mockFallback;
  }

  try {
    const messages: AmveraMessage[] = [
      { role: "system", text: system },
      { role: "user", text: user },
    ];

    const url = `${AMVERA_BASE_URL}/models/gpt`;

    console.log("[LLM] Calling Amvera:", url, "model:", AMVERA_MODEL);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": `Bearer ${AMVERA_API_KEY}`,
      },
      body: JSON.stringify(buildPayload(messages)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] Amvera API error:", response.status, response.statusText, errorText);
      return mockFallback;
    }

    const data: AmveraResponse = await response.json();
    const content = data?.choices?.[0]?.message?.text;

    if (!content) {
      console.error("[LLM] No text in response:", JSON.stringify(data));
      return mockFallback;
    }

    console.log("[LLM] Response length:", content.length, "chars");

    const result = parseResponse(content);
    if (!result) {
      console.error("[LLM] Parse failed. Raw:", content.substring(0, 500));
      return mockFallback;
    }

    return result;
  } catch (e) {
    console.error("[LLM] Call failed:", e);
    return mockFallback;
  }
}

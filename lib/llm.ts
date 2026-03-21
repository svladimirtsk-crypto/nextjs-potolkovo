// file: lib/llm.ts

import type { AdvisorOutput } from "./types";
import { advisorOutputSchema } from "./schemas";

const AMVERA_API_KEY = process.env.AMVERA_API_KEY || "";
const AMVERA_BASE_URL = process.env.AMVERA_BASE_URL || "https://api.amvera.ru/v1";
const AMVERA_MODEL = process.env.AMVERA_MODEL || "gpt-4.1";
const MOCK_AI = process.env.MOCK_AI === "true";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function buildPayload(messages: ChatMessage[]) {
  return {
    model: AMVERA_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: "json_object" as const },
  };
}

function extractJSON(text: string): string {
  // Try to find JSON in the text
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
    console.error("[LLM] Validation failed:", validated.error.issues);
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
    console.warn("[LLM] No AMVERA_API_KEY, returning mock");
    return mockFallback;
  }

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    const response = await fetch(`${AMVERA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AMVERA_API_KEY}`,
      },
      body: JSON.stringify(buildPayload(messages)),
    });

    if (!response.ok) {
      console.error("[LLM] API error:", response.status, await response.text());
      return mockFallback;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[LLM] No content in response");
      return mockFallback;
    }

    const result = parseResponse(content);
    if (!result) {
      console.error("[LLM] Failed to parse, returning mock");
      return mockFallback;
    }

    return result;
  } catch (e) {
    console.error("[LLM] Call failed:", e);
    return mockFallback;
  }
}

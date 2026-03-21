// file: lib/llm.ts

import type { AdvisorOutput } from "./types";
import { advisorOutputSchema } from "./schemas";

const AMVERA_AUTH_TOKEN =
  process.env.AMVERA_API_KEY || process.env.AMVERA_API_TOKEN || "";

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
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: {
      role?: string;
      text?: string;
      content?: string;
    };
    finish_reason?: string;
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
    temperature: 0.6,
    max_completion_tokens: 1000,
    n: 1,
  };
}

function normalizeAuthToken(token: string): string {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    const objectInsideFence = inner.match(/\{[\s\S]*\}/);
    return objectInsideFence?.[0] || inner;
  }

  const directObject = text.match(/\{[\s\S]*\}/);
  if (directObject?.[0]) {
    return directObject[0];
  }

  return text.trim();
}

function parseResponse(raw: string): AdvisorOutput | null {
  try {
    const jsonStr = extractJSON(raw);
    const parsed = JSON.parse(jsonStr);
    const validated = advisorOutputSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }

    console.error("[LLM] Zod validation failed:", validated.error.issues);
    console.error("[LLM] Raw response for failed validation:", raw);
    return null;
  } catch (error) {
    console.error("[LLM] JSON parse failed:", error);
    console.error("[LLM] Raw response for failed parse:", raw);
    return null;
  }
}

export async function callLLM(
  system: string,
  user: string,
  mockFallback: AdvisorOutput
): Promise<AdvisorOutput> {
  if (MOCK_AI) {
    console.log("[LLM] MOCK_AI=true, returning mock fallback");
    return mockFallback;
  }

  if (!AMVERA_AUTH_TOKEN) {
    console.warn(
      "[LLM] No Amvera token found. Set AMVERA_API_KEY or AMVERA_API_TOKEN. Returning mock fallback."
    );
    return mockFallback;
  }

  try {
    const messages: AmveraMessage[] = [
      { role: "system", text: system },
      { role: "user", text: user },
    ];

    const url = `${AMVERA_BASE_URL}/models/gpt`;

    console.log("[LLM] Calling Amvera:", {
      url,
      model: AMVERA_MODEL,
      mock: MOCK_AI,
      hasToken: Boolean(AMVERA_AUTH_TOKEN),
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": normalizeAuthToken(AMVERA_AUTH_TOKEN),
      },
      body: JSON.stringify(buildPayload(messages)),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[LLM] Amvera API error:",
        response.status,
        response.statusText,
        errorText
      );
      return mockFallback;
    }

    const data: AmveraResponse = await response.json();
    const content =
      data?.choices?.[0]?.message?.text ??
      data?.choices?.[0]?.message?.content ??
      "";

    if (!content) {
      console.error("[LLM] Empty content in response:", JSON.stringify(data));
      return mockFallback;
    }

    console.log("[LLM] Raw response length:", content.length);

    const parsed = parseResponse(content);
    if (!parsed) {
      console.error("[LLM] Returning mock fallback because parsing/validation failed");
      return mockFallback;
    }

    return parsed;
  } catch (error) {
    console.error("[LLM] Call failed:", error);
    return mockFallback;
  }
}

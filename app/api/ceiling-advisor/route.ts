// file: app/api/ceiling-advisor/route.ts

import { NextRequest, NextResponse } from "next/server";
import { advisorInputSchema } from "@/lib/schemas";
import { computeContext, computeTechContext } from "@/lib/ceiling-rules";
import { buildRoomSelectionPrompt, buildTechQuestionPrompt } from "@/lib/prompts";
import { callLLM } from "@/lib/llm";
import { getMockRoomSelection, getMockTechQuestion } from "@/lib/mock";
import type { RoomSelectionInput, TechQuestionInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = advisorInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Некорректные данные",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    if (input.scenario === "room-selection") {
      return handleRoomSelection(input);
    } else {
      return handleTechQuestion(input);
    }
  } catch (e) {
    console.error("[API] Unhandled error:", e);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

async function handleRoomSelection(input: RoomSelectionInput) {
  const ctx = computeContext(
    input.roomType,
    input.area,
    input.ceilingHeight,
    input.priority,
    input.lightingNeed,
    input.concern,
    input.budget
  );

  const mockFallback = getMockRoomSelection(ctx);
  const { system, user } = buildRoomSelectionPrompt(input, ctx);
  const result = await callLLM(system, user, mockFallback);

  return NextResponse.json(result);
}

async function handleTechQuestion(input: TechQuestionInput) {
  const ctx = computeTechContext(
    input.question,
    input.roomType,
    input.ceilingHeight
  );

  const mockFallback = getMockTechQuestion();
  const { system, user } = buildTechQuestionPrompt(input, ctx);
  const result = await callLLM(system, user, mockFallback);

  return NextResponse.json(result);
}
